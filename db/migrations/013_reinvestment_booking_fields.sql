-- 013_reinvestment_booking_fields.sql
--
-- Adds the three columns the reinvestment feature needs on
-- `project_investment_bookings`, so a matured investor can roll capital (and
-- optionally profit) into a new booking without a fresh bank transfer.
--
-- WHY
--   `reinvest.ts` and `mis/dashboard.ts` were written against these columns,
--   but no migration ever added them and the Sequelize model never declared
--   them. On api-test (`saathi_db`) the columns already exist — added by hand
--   at some point — and already hold one real 'reinvestment' row. This
--   migration exists so the same schema can be reproduced on any other
--   database (production included) before those routes are deployed there.
--
-- APPLY
--   Skip on any database where `SHOW COLUMNS FROM project_investment_bookings
--   LIKE 'booking_type'` already returns a row — api-test is one of those.
--   node db/migrate.mjs db/migrations/013_reinvestment_booking_fields.sql

START TRANSACTION;

ALTER TABLE `project_investment_bookings`
    ADD COLUMN `booking_type` ENUM('fresh', 'reinvestment') NOT NULL DEFAULT 'fresh' AFTER `cancelled`,
    ADD COLUMN `reinvested_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0.00 AFTER `booking_type`,
    ADD COLUMN `id_source_project_investors` INT NULL AFTER `reinvested_amount`;

COMMIT;

-- Verify
--   SHOW FULL COLUMNS FROM project_investment_bookings
--     WHERE Field IN ('booking_type', 'reinvested_amount', 'id_source_project_investors');
