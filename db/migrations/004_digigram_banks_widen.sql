-- 004_digigram_banks_widen.sql
--
-- Widens the `digigram_banks` text columns and rewrites the row.
--
-- WHY
--   `branch_name` was VARCHAR(25). The correct branch —
--   "Dhanmondi Branch (Dhanmondi 15)", 31 characters — was written by
--   migration 003 and MySQL stored "Dhanmondi Branch (Dhanmon", silently.
--   The server's sql_mode is `IGNORE_SPACE,NO_ENGINE_SUBSTITUTION`, with no
--   STRICT_TRANS_TABLES, so an over-length write is a warning rather than an
--   error and the truncation went unreported.
--
--   This is the account investors send money to. A half-written branch name is
--   the mild version of that failure mode; the same column widths would have
--   silently cut an account name too (VARCHAR(55)).
--
-- Safe on a live system: widening a VARCHAR never loses data, and the table
-- holds a single row.
--
-- APPLY
--   node db/migrate.mjs db/migrations/004_digigram_banks_widen.sql

ALTER TABLE `digigram_banks`
    MODIFY `bank_name`   VARCHAR(120) NOT NULL,
    MODIFY `branch_name` VARCHAR(120) NOT NULL,
    MODIFY `account_name` VARCHAR(120) NOT NULL;

-- Rewrite the branch name that 003 could not fit.
UPDATE `digigram_banks`
SET `branch_name` = 'Dhanmondi Branch (Dhanmondi 15)',
    `updated_at`  = NOW()
WHERE `account_number` = '1301000365084';

-- Verify
--   SELECT bank_name, branch_name, account_name, account_number, routing_number
--   FROM digigram_banks;
--
-- Separately, and NOT changed here: consider adding STRICT_TRANS_TABLES to the
-- server's sql_mode. It would have turned this silent truncation into an error.
-- It is deliberately left alone because switching it on turns every existing
-- silent truncation elsewhere in the app into a hard failure, which needs its
-- own testing pass rather than riding along with a bank-details fix.
