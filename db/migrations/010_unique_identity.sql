-- 010_unique_identity.sql
--
-- Makes it *impossible* for two live accounts to share an email address or a
-- phone number.
--
-- ⚠️  RUN THIS LAST, AND ONLY AFTER THE EXISTING DUPLICATES ARE MERGED.
--    Creating a unique index over data that already violates it fails with
--    ER_DUP_ENTRY and rolls back. Three pairs of active accounts share an email
--    address today. Merge them first:
--
--      node db/find-duplicate-accounts.mjs          # lists them
--      node db/merge-accounts.mjs --dry-run         # shows what would move
--      node db/merge-accounts.mjs
--
--    Then run this. If it still fails, the message names the offending value —
--    that is a duplicate that appeared after the merge pass, not a bug here.
--
-- WHY A GENERATED COLUMN INSTEAD OF A PLAIN UNIQUE INDEX
--   A plain `UNIQUE (email)` would also constrain `deleted` and `merged` rows,
--   and those must be allowed to keep their original address — that is what
--   makes a merge reversible and an audit trail readable. MySQL has no partial
--   indexes, so the condition goes into a generated column instead: it holds
--   the address for live accounts and NULL for everything else, and MySQL
--   permits any number of NULLs in a unique index.
--
--   Lower-cased, because `A@b.com` and `a@b.com` are the same mailbox and
--   treating them as two accounts is exactly the bug being closed.
--
-- WHAT THIS PROTECTS AGAINST
--   The duplicate accounts already in the data were created by application
--   logic that looked up an email with extra conditions attached and missed a
--   match. That specific bug is fixed, but the database is the only place a
--   guarantee can actually be enforced — a future code path, a script, or an
--   admin edit cannot get around this one.
--
-- SAFE BEFORE THE APP RELEASE, WITH ONE CAVEAT
--   Existing behaviour is unchanged for every account that is not a duplicate.
--   The caveat: a write that *would* have created a duplicate now fails with a
--   database error instead of succeeding. Every such path in the API has been
--   changed to check first and offer a merge, so this is a backstop rather than
--   the primary control — but if an old client hits an old endpoint, it gets an
--   error rather than a second account. That is the intended trade.
--
-- APPLY
--   node db/migrate.mjs db/migrations/010_unique_identity.sql

-- Email ------------------------------------------------------------------

SET @has_col := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'email_identity'
);
SET @sql := IF(@has_col = 0,
    'ALTER TABLE `users` ADD COLUMN `email_identity` VARCHAR(255)
        GENERATED ALWAYS AS (
            IF(`status` IN (''active'', ''inactive'') AND `email` IS NOT NULL AND `email` <> '''',
               LOWER(TRIM(`email`)), NULL)
        ) STORED',
    'SELECT ''users.email_identity already present, skipping'' AS note');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_idx := (
    SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'uq_users_email_identity'
);
SET @sql := IF(@has_idx = 0,
    'ALTER TABLE `users` ADD UNIQUE INDEX `uq_users_email_identity` (`email_identity`)',
    'SELECT ''uq_users_email_identity already present, skipping'' AS note');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Phone ------------------------------------------------------------------
--
-- No duplicates exist today, but the same guarantee belongs on both channels:
-- the merge flow can attach a phone number to an account, and that write must
-- not be able to steal a number from a live account.

SET @has_col := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'phone_identity'
);
SET @sql := IF(@has_col = 0,
    'ALTER TABLE `users` ADD COLUMN `phone_identity` VARCHAR(20)
        GENERATED ALWAYS AS (
            IF(`status` IN (''active'', ''inactive'') AND `phone_number` IS NOT NULL AND `phone_number` <> '''',
               TRIM(`phone_number`), NULL)
        ) STORED',
    'SELECT ''users.phone_identity already present, skipping'' AS note');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_idx := (
    SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'uq_users_phone_identity'
);
SET @sql := IF(@has_idx = 0,
    'ALTER TABLE `users` ADD UNIQUE INDEX `uq_users_phone_identity` (`phone_identity`)',
    'SELECT ''uq_users_phone_identity already present, skipping'' AS note');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Verify
--   SHOW INDEX FROM users WHERE Key_name LIKE 'uq_%';
--   -- both must return zero rows:
--   SELECT email_identity, COUNT(*) n FROM users WHERE email_identity IS NOT NULL
--     GROUP BY email_identity HAVING n > 1;
--   SELECT phone_identity, COUNT(*) n FROM users WHERE phone_identity IS NOT NULL
--     GROUP BY phone_identity HAVING n > 1;
