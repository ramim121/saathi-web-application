-- 003_digigram_bank_details.sql
--
-- Makes `digigram_banks` the single source of truth for the account investors
-- pay into, and corrects the row.
--
-- WHY
--   `GET /api/digigram_bank_info` already existed and served this table, but the
--   mobile app ignored it and hardcoded the values in
--   `SubmitProofOfPayment.tsx`. The two disagreed:
--
--     table (test DB, last touched 2024-07-10) : United Commercial Bank Ltd.,
--                                                SAATHI LTD, A/C 0124563214789
--     app (what investors actually pay into)   : Mutual Trust Bank Plc.,
--                                                DIGIGRAM VENTURES LTD.,
--                                                A/C 1301000365084
--
--   Confirmed by the client: the app's values are correct. This migration
--   writes them into the table so both the app and the website can read one
--   place, and so a future bank change is an UPDATE rather than an app release.
--
-- ⚠️  THIS IS THE ACCOUNT INVESTORS SEND MONEY TO.
--    Verify every digit against a bank statement before running this on
--    production. A typo here misdirects real payments.
--
-- APPLY
--   mysql -h <host> -u <user> -p <database> < db/migrations/003_digigram_bank_details.sql

START TRANSACTION;

-- Update in place if a row exists, insert if the table is empty. Written as two
-- statements rather than REPLACE so an existing id (and any FK pointing at it)
-- survives.

UPDATE `digigram_banks`
SET
    `bank_name`      = 'Mutual Trust Bank Plc.',
    `branch_name`    = 'Dhanmondi Branch (Dhanmondi 15)',
    `account_name`   = 'DIGIGRAM VENTURES LTD.',
    `account_number` = '1301000365084',
    `routing_number` = '145261188',
    `updated_at`     = NOW()
WHERE `id_digigram_banks` = (
    SELECT * FROM (SELECT MIN(`id_digigram_banks`) FROM `digigram_banks`) AS t
);

INSERT INTO `digigram_banks`
    (`bank_name`, `branch_name`, `account_name`, `account_number`, `routing_number`, `created_at`, `updated_at`)
SELECT
    'Mutual Trust Bank Plc.',
    'Dhanmondi Branch (Dhanmondi 15)',
    'DIGIGRAM VENTURES LTD.',
    '1301000365084',
    '145261188',
    NOW(),
    NOW()
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `digigram_banks`);

COMMIT;

-- Verify
--   SELECT * FROM digigram_banks;
--
-- Follow-up, outside this migration:
--   `saathi-mobile-app/src/screens/Order/SubmitProofOfPayment.tsx` still
--   hardcodes these values (~lines 670 and 709). Point it at
--   /api/digigram_bank_info in the next app release, otherwise the duplication
--   — and the chance of them drifting apart again — remains.
