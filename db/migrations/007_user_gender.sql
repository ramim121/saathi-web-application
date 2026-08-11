-- 007_user_gender.sql
--
-- Adds `gender` to `users`.
--
-- WHY
--   Web signup asks for name and gender immediately after the account is
--   created, and everything else is deferred to the profile screen. `full_name`
--   already exists; there was no gender column at all.
--
-- NULLABLE ON PURPOSE
--   425 existing accounts predate this column and 121 of them do not even have
--   a name. A NOT NULL column would need a default, and defaulting somebody's
--   gender is worse than leaving it unknown — every existing profile update
--   would silently stamp a value the user never chose. The *form* makes it
--   required for new signups; the *column* stays nullable so old rows can say
--   "not answered" honestly.
--
--   `prefer_not_to_say` is a real answer and is distinct from NULL, which means
--   "never asked".
--
-- SAFE BEFORE THE APP RELEASE
--   Purely additive. The shipped app never selects this column, and Sequelize
--   selects an explicit attribute list, so nothing existing changes shape.
--
-- APPLY
--   node db/migrate.mjs db/migrations/007_user_gender.sql

SET @exists := (
    SELECT COUNT(*)
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'users'
      AND COLUMN_NAME  = 'gender'
);

SET @sql := IF(
    @exists = 0,
    'ALTER TABLE `users` ADD COLUMN `gender` ENUM(''male'', ''female'', ''other'', ''prefer_not_to_say'') NULL DEFAULT NULL AFTER `full_name`',
    'SELECT ''users.gender already present, skipping'' AS note'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Verify
--   SHOW COLUMNS FROM users LIKE 'gender';
