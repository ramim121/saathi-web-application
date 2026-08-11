-- 001_app_otps.sql
--
-- Persist one-time passcodes instead of holding them in the API process.
--
-- Why: OTPs lived in a module-level object, so every `pm2 delete` + `pm2 start`
-- deploy invalidated all codes in flight, and under more than one instance the
-- worker that issued a code was often not the worker asked to verify it.
--
-- Run against the Shathi database BEFORE deploying the matching code change.
-- Safe to run on a live system: it only creates a new table.
--
--   mysql -h <host> -u <user> -p <database> < db/migrations/001_app_otps.sql

CREATE TABLE IF NOT EXISTS `app_otps` (
  `id_app_otps` INT NOT NULL AUTO_INCREMENT,
  `phone_number` VARCHAR(20) NOT NULL,
  -- SHA-256 hex digest. The code itself is never stored, so a database dump
  -- does not hand over live passcodes.
  `otp_hash` VARCHAR(64) NOT NULL,
  `expires_at` DATETIME NOT NULL,
  `attempts` INT NOT NULL DEFAULT 0,
  `consumed_at` DATETIME NULL DEFAULT NULL,
  `created_at` DATETIME NOT NULL,
  `updated_at` DATETIME NOT NULL,
  PRIMARY KEY (`id_app_otps`),
  KEY `idx_app_otps_phone` (`phone_number`),
  KEY `idx_app_otps_expires` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Housekeeping: consumed and expired rows are never read again. Either run
-- this periodically from cron, or add an event scheduler entry.
--
--   DELETE FROM `app_otps`
--   WHERE `expires_at` < DATE_SUB(NOW(), INTERVAL 7 DAY);
