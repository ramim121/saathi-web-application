-- 014_investor_balance.sql
--
-- Money held for an investor between investments, plus the two notifications
-- the reinvestment flow sends.
--
-- WHY
--   A matured investment rarely reinvests into whole units exactly. The part
--   that does not make a whole unit, and, when only the capital is
--   reinvested, the profit, is owed to the investor until it is paid out or
--   put toward a later investment. Nothing recorded that before.
--
--   `investor_balance_entries` is a ledger: one signed row per movement
--   (+ owed to the investor, - paid out or used). The balance is the sum.
--   Rows are never edited: a mistake is undone by a `reversal` row.
--
-- APPLY (idempotent: the table is created if missing, templates inserted if missing)
--   node db/migrate.mjs db/migrations/014_investor_balance.sql
--
-- NOTE: the runner splits on semicolons, so the message texts below avoid them.

CREATE TABLE IF NOT EXISTS `investor_balance_entries` (
    `id_investor_balance_entries` INT NOT NULL AUTO_INCREMENT,
    `id_users` INT NOT NULL,
    `amount` DECIMAL(12, 2) NOT NULL,
    `entry_type` ENUM('profit_payable', 'reinvest_remainder', 'applied_to_booking', 'paid_out', 'reversal', 'adjustment') NOT NULL,
    `id_project_investors` INT NULL,
    `id_project_investment_bookings` INT NULL,
    `reverses_id` INT NULL,
    `note` VARCHAR(255) NULL,
    `created_by` INT NULL,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id_investor_balance_entries`),
    KEY `idx_investor_balance_user` (`id_users`),
    KEY `idx_investor_balance_booking` (`id_project_investment_bookings`)
);

INSERT INTO `notification_templates`
    (`notification_name`, `sms_template`, `email_subject`, `email_template`, `push_notification_title`, `push_notification_template`)
SELECT
    'reinvestment_topup_due',
    'Shathi: your matured investment is being reinvested as booking ${data.bookingId} (BDT ${data.investment}). Please pay the top-up of BDT ${data.topUp} and upload the payment proof in the Shathi app.',
    'Reinvestment ${data.bookingId}: top-up of BDT ${data.topUp} due',
    'reinvestment_topup_due',
    'Reinvestment: top-up due',
    'Booking ${data.bookingId}: please pay BDT ${data.topUp} and upload the payment proof in the app.'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `notification_templates` WHERE `notification_name` = 'reinvestment_topup_due');

INSERT INTO `notification_templates`
    (`notification_name`, `sms_template`, `email_subject`, `email_template`, `push_notification_title`, `push_notification_template`)
SELECT
    'reinvestment_confirmed',
    'Shathi: your matured investment has been reinvested. New booking ${data.bookingId}: BDT ${data.investment} in ${data.projectName}, from ${data.startDate}.${data.note}',
    'Reinvestment ${data.bookingId} is active',
    'reinvestment_confirmed',
    'Reinvestment confirmed',
    'Booking ${data.bookingId}: BDT ${data.investment} reinvested in ${data.projectName}.'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `notification_templates` WHERE `notification_name` = 'reinvestment_confirmed');

-- Verify
--   SHOW CREATE TABLE investor_balance_entries
--   SELECT notification_name FROM notification_templates WHERE notification_name LIKE 'reinvestment_%'
