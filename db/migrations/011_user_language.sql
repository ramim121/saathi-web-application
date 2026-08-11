-- 011_user_language.sql
--
-- Which language to write to somebody in.
--
-- WHY
--   Every notification exists in English and Bangla now, and nothing in the
--   database says which one a given person should receive. Without this the
--   only options are guessing, or sending both languages in one message and
--   making everybody read past half of it.
--
-- DEFAULTS TO NULL, NOT TO A LANGUAGE
--   NULL means "never asked", and the renderer treats it as English — which is
--   what all 425 existing accounts have been receiving, so nobody's mail
--   changes language underneath them. The website sets it from the locale the
--   person actually signed up in, and the profile screen can change it.
--
--   Defaulting the column to 'en' would look identical today and be wrong
--   later: there would be no way to tell somebody who chose English from
--   somebody who was never asked.
--
-- SAFE BEFORE THE APP RELEASE
--   Additive and nullable. The shipped app neither reads nor writes it.
--
-- APPLY
--   node db/migrate.mjs db/migrations/011_user_language.sql

SET @exists := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'preferred_language'
);

SET @sql := IF(
    @exists = 0,
    'ALTER TABLE `users` ADD COLUMN `preferred_language` ENUM(''en'', ''bn'') NULL DEFAULT NULL AFTER `gender`',
    'SELECT ''users.preferred_language already present, skipping'' AS note'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Verify
--   SHOW COLUMNS FROM users LIKE 'preferred_language';
