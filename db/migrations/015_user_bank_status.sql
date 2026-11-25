-- 015_user_bank_status.sql
--
-- Adds `status` to `user_banks` so an investor can remove a payout account.
--
-- WHY NOT DELETE THE ROW
--   `project_investment_bookings.id_user_banks` records the account a booking
--   was paid from. Deleting the row would orphan that reference and lose the
--   payment record the admin reconciles against. A removed account keeps its
--   row; the UserBank model's default scope hides it from the investor's lists,
--   login payloads and ownership checks, while booking details still read it.
--
-- SAFE TO RUN ON A LIVE DATABASE
--   Additive column with a default: every existing account stays 'active' and
--   no current query changes behaviour until the new code is deployed.

ALTER TABLE `user_banks`
    ADD COLUMN `status` ENUM('active', 'removed') NOT NULL DEFAULT 'active' AFTER `default`;
