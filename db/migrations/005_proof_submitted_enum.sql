-- 005_proof_submitted_enum.sql
--
-- Adds `proof_submitted` to the payment status ENUM, alongside the legacy
-- `uploaded`.
--
-- WHY BOTH, FOR NOW
--   `uploaded` is the value written when an investor submits a receipt. It is
--   being renamed to `proof_submitted`, but the **shipped mobile app** compares
--   the raw string in two screens (MyInvestment, PendingProofOfPaymentList), and
--   a binary already installed cannot be updated by a deploy. Widening the ENUM
--   first lets every reader accept both, so the writer can be flipped later
--   without a flag day.
--
--   The order that matters: readers first, app release second, writer last.
--   See src/utils/bookingStatus.ts and 006_rename_uploaded_status.sql.
--
-- Safe on a live system: adding a member to an ENUM at the end of the list does
-- not rewrite existing rows and does not change any stored value.
--
-- APPLY
--   node db/migrate.mjs db/migrations/005_proof_submitted_enum.sql

ALTER TABLE `project_investment_bookings`
    MODIFY `payment_confirmation_status`
        ENUM('pending', 'uploaded', 'proof_submitted', 'confirmed', 'denied')
        NOT NULL DEFAULT 'pending';

-- Verify
--   SHOW COLUMNS FROM project_investment_bookings LIKE 'payment_confirmation_status';
