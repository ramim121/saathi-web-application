-- 009_account_merge.sql
--
-- Bookkeeping for merging two accounts that belong to the same person.
--
-- WHY
--   Of 425 active accounts, only 63 have both a phone number and an email
--   address. Someone who registered by phone and later signs in with Google
--   gets a *second* account, and there is currently no way back: the signed-in
--   branch of `PUT /api/otp` detects the collision and answers "Phone number
--   already exists", with no offer to join them up.
--
--   Three such duplicate pairs already exist in the data.
--
-- NOTHING IS EVER DELETED
--   A merge re-points rows to the surviving account and marks the other
--   `status = 'merged'` with `merged_into` pointing at the survivor. The row
--   stays forever, which means:
--     * the audit trail still explains where those bookings came from;
--     * a merge done in error can be reversed;
--     * a stale JWT naming the merged account can be recognised and redirected
--       to the survivor rather than silently authenticating nobody.
--
--   `deleted` already existed and means something different — the user asked to
--   leave. Do not conflate them.
--
-- WHY NO UNIQUE INDEX HERE
--   A unique index on email is the real fix for duplicates, but it cannot be
--   added yet: three pairs of active accounts share an address today and the
--   index creation would fail. Migration 010 adds it *after* those three have
--   been merged. Splitting them keeps this migration runnable on any database.
--
-- SAFE BEFORE THE APP RELEASE
--   Additive columns plus two lookup indexes. Widening the `status` ENUM cannot
--   affect existing rows, and the shipped app never writes 'merged'.
--
--   One thing to know: the app's own queries filter on `status` in places
--   (`status: ['active', 'inactive']`), so a merged account is already excluded
--   from those without an app change. That is the intended behaviour.
--
-- APPLY
--   node db/migrate.mjs db/migrations/009_account_merge.sql

START TRANSACTION;

ALTER TABLE `users`
    MODIFY `status` ENUM('active', 'inactive', 'deleted', 'merged')
        NULL DEFAULT 'active';

COMMIT;

-- Columns, guarded so the migration is safe to re-run.

SET @has_merged_into := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'merged_into'
);
SET @sql := IF(@has_merged_into = 0,
    'ALTER TABLE `users` ADD COLUMN `merged_into` INT NULL DEFAULT NULL, ADD COLUMN `merged_at` DATETIME NULL DEFAULT NULL',
    'SELECT ''users.merged_into already present, skipping'' AS note');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Lookup indexes.
--
-- Sign-in reads `users` by email and by phone on every attempt, and the merge
-- check reads it twice more. With only a PRIMARY key on `id_users`, all of that
-- is a full table scan today.

SET @has_email_idx := (
    SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'idx_users_email'
);
SET @sql := IF(@has_email_idx = 0,
    'ALTER TABLE `users` ADD INDEX `idx_users_email` (`email`)',
    'SELECT ''idx_users_email already present, skipping'' AS note');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_phone_idx := (
    SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'idx_users_phone'
);
SET @sql := IF(@has_phone_idx = 0,
    'ALTER TABLE `users` ADD INDEX `idx_users_phone` (`phone_number`)',
    'SELECT ''idx_users_phone already present, skipping'' AS note');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- Verify
--   SHOW COLUMNS FROM users LIKE 'merged%';
--   SHOW INDEX FROM users;
--   SELECT status, COUNT(*) FROM users GROUP BY status;
