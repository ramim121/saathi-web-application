-- 008_email_verifications.sql
--
-- Storage for email-address verification, mirroring `app_otps` (migration 001).
--
-- WHY
--   `users.email_verified` exists and is read all over the codebase, but there
--   was never a way for a user to *earn* it. Today it is set to 'yes' in
--   exactly one place — the Google sign-in handler — because Google asserts the
--   address. Anyone who typed an email into their profile is stuck at 'no'
--   forever, which is also what makes the Google handler create a duplicate
--   account for them (it only matches on verified/linked addresses).
--
-- TWO WAYS TO VERIFY, ONE ROW
--   A link is the better experience on desktop; a 6-digit code is the only
--   thing that works when the mail app and the browser are different apps on a
--   phone. Both are issued from the same row so a user can use whichever
--   arrives first, and consuming either burns both.
--
-- ONLY DIGESTS ARE STORED
--   Same reasoning as `app_otps`: a database dump must not hand out live
--   credentials. The token and the code are shown to the user exactly once, in
--   the email, and never persisted in the clear.
--
-- `email` IS STORED ON THE ROW, NOT READ FROM `users`
--   The address being proved is the one that was requested, not whatever
--   `users.email` happens to say when the link is clicked. Otherwise changing
--   the address after requesting a link would let the old link verify the new
--   address.
--
-- SAFE BEFORE THE APP RELEASE
--   A new table. Nothing existing reads or writes it.
--
-- APPLY
--   node db/migrate.mjs db/migrations/008_email_verifications.sql

CREATE TABLE IF NOT EXISTS `email_verifications` (
    `id_email_verifications` INT NOT NULL AUTO_INCREMENT,
    `id_users`     INT          NOT NULL,
    `email`        VARCHAR(255) NOT NULL,
    `token_hash`   VARCHAR(64)  NOT NULL,
    `code_hash`    VARCHAR(64)  NOT NULL,
    `expires_at`   DATETIME     NOT NULL,
    `attempts`     INT          NOT NULL DEFAULT 0,
    `consumed_at`  DATETIME     NULL DEFAULT NULL,
    `created_at`   DATETIME     NOT NULL,
    `updated_at`   DATETIME     NOT NULL,
    PRIMARY KEY (`id_email_verifications`),
    -- Lookup by token happens on every click of a verification link.
    KEY `idx_email_verifications_token` (`token_hash`),
    -- Lookup by user happens on the code path and on resend throttling.
    KEY `idx_email_verifications_user` (`id_users`, `consumed_at`),
    KEY `idx_email_verifications_email` (`email`),
    CONSTRAINT `email_verifications_ibfk_1`
        FOREIGN KEY (`id_users`) REFERENCES `users` (`id_users`)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

-- Verify
--   SHOW CREATE TABLE email_verifications;
