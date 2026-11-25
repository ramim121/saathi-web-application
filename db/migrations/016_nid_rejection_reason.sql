-- 016_nid_rejection_reason.sql
--
-- Adds `nid_rejection_reason` to `users`.
--
-- WHY
--   When an admin rejects NID photos the investor only learned "not accepted"
--   and had to guess what to fix (blurry, cut off, wrong side, expired card).
--   The admin now writes a short reason when rejecting; the app shows it next
--   to the upload slots. It is cleared on approval and on a new upload.
--
-- SAFE TO RUN ON A LIVE DATABASE
--   Nullable, no default: existing rows read NULL ("no reason recorded").

ALTER TABLE `users`
    ADD COLUMN `nid_rejection_reason` VARCHAR(500) NULL AFTER `nid_verification_status`;
