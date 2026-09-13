-- 006_rename_uploaded_status.sql
--
-- ⚠️ DO NOT RUN THIS YET.
--
-- Completes the `uploaded` → `proof_submitted` rename. Run it **only after**:
--
--   1. 005_proof_submitted_enum.sql has been applied;
--   2. a mobile app release built from the current source — which accepts both
--      values — is live and adopted;
--   3. `PROOF_SUBMITTED_WRITE_VALUE` in src/utils/bookingStatus.ts has been
--      flipped to `proof_submitted` and deployed.
--
-- Running it before step 2 makes the two screens in the shipped app
-- (MyInvestment, PendingProofOfPaymentList) misread every submitted booking,
-- because they compare the raw string `'uploaded'`.
--
-- APPLY (when the conditions above hold)
--   node db/migrate.mjs db/migrations/006_rename_uploaded_status.sql --dry-run
--   node db/migrate.mjs db/migrations/006_rename_uploaded_status.sql

UPDATE `project_investment_bookings`
SET `payment_confirmation_status` = 'proof_submitted'
WHERE `payment_confirmation_status` = 'uploaded';

-- Optional, once no row holds the legacy value and no code writes it:
--
--   ALTER TABLE `project_investment_bookings`
--       MODIFY `payment_confirmation_status`
--           ENUM('pending', 'proof_submitted', 'confirmed', 'denied')
--           NOT NULL DEFAULT 'pending';
--
-- Leave that until last. While the column still accepts 'uploaded', this
-- migration is reversible with the inverse UPDATE.

-- Verify
--   SELECT payment_confirmation_status, COUNT(*)
--   FROM project_investment_bookings GROUP BY 1;
