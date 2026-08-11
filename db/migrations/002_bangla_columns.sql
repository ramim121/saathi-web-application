-- 002_bangla_columns.sql
--
-- Adds Bangla counterparts (`*_bn`) to every translatable column across the
-- admin panels, so the website can serve a full Bangla mirror from the same
-- records rather than a parallel content store.
--
-- SAFETY
--   * Every column is nullable with no default. Existing rows are untouched and
--     no existing query changes behaviour — a NULL `*_bn` simply means "not
--     translated yet", and the application falls back to the English column.
--   * `ALTER TABLE ... ADD COLUMN` at the end of a table is an INSTANT operation
--     on MySQL 8.0, so this does not lock or rebuild the tables.
--   * Re-runnable. Each add goes through `add_column_if_missing`, so applying
--     this file twice is a no-op rather than an error.
--
--   * NEVER run `src/models/__sync.ts` to apply this. It calls
--     `.sync({ force: true })`, which drops every table.
--
-- APPLY
--   mysql -h <host> -u <user> -p <database> < db/migrations/002_bangla_columns.sql

DELIMITER $$

DROP PROCEDURE IF EXISTS add_column_if_missing$$
CREATE PROCEDURE add_column_if_missing(
    IN in_table  VARCHAR(64),
    IN in_column VARCHAR(64),
    IN in_definition VARCHAR(255)
)
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME   = in_table
          AND COLUMN_NAME  = in_column
    ) THEN
        SET @ddl = CONCAT('ALTER TABLE `', in_table, '` ADD COLUMN `', in_column, '` ', in_definition);
        PREPARE stmt FROM @ddl;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END$$

DELIMITER ;

-- Bangla text needs utf8mb4. Stated explicitly on each column so the result does
-- not depend on the table or server default.
SET @vc  = 'VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL';
SET @vc100 = 'VARCHAR(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL';
SET @txt = 'TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL';

-- ---------------------------------------------------------------------------
-- Projects panel
-- ---------------------------------------------------------------------------
CALL add_column_if_missing('projects', 'project_name_bn',    @vc);
CALL add_column_if_missing('projects', 'summary_bn',         @txt);
CALL add_column_if_missing('projects', 'description_bn',     @txt);
CALL add_column_if_missing('projects', 'location_bn',        @vc);
CALL add_column_if_missing('projects', 'other_locations_bn', @vc);

-- Numeric, date and enum columns are deliberately NOT duplicated. Amounts,
-- durations and dates are formatted per-locale at render time (Bangla digits in
-- prose, Western in tables); enums are keys, and their labels are translated in
-- the front end, not in the database.

-- ---------------------------------------------------------------------------
-- Project categories
-- ---------------------------------------------------------------------------
CALL add_column_if_missing('project_categories', 'category_name_bn', @vc);

-- ---------------------------------------------------------------------------
-- Blogs / News & insights
-- ---------------------------------------------------------------------------
-- `heading` is VARCHAR(100); the Bangla column matches it. Note that MySQL
-- counts characters, not bytes, so 100 Bangla characters fit.
CALL add_column_if_missing('blogs', 'heading_bn',     @vc100);
CALL add_column_if_missing('blogs', 'description_bn', @txt);

-- ---------------------------------------------------------------------------
-- Investor testimonials
-- ---------------------------------------------------------------------------
CALL add_column_if_missing('investor_testimonials', 'name_bn',        @vc);
CALL add_column_if_missing('investor_testimonials', 'testimonial_bn', @txt);

-- ---------------------------------------------------------------------------
-- Partnerships
-- ---------------------------------------------------------------------------
CALL add_column_if_missing('partnerships', 'name_bn', @vc);

-- ---------------------------------------------------------------------------
-- App stat panel
-- ---------------------------------------------------------------------------
-- Every live row is currently `statType = 'image'`, so this panel is an image
-- carousel in practice. The label/value columns are still translated for the
-- 'text' and 'number' types the schema allows.
CALL add_column_if_missing('app_stat_panel', 'stat_label_bn', @vc);
CALL add_column_if_missing('app_stat_panel', 'stat_value_bn', @vc);

-- ---------------------------------------------------------------------------
-- Partner profiles (the `users` table, partner rows)
-- ---------------------------------------------------------------------------
-- These render on the public partner cards and partner profile, which the
-- website mirrors, so they need Bangla too. `full_name` is included because a
-- Bangla site should show a partner's name in Bangla script.
--
-- Contact, identity and verification columns are NOT translated — they are data,
-- not copy, and most of them have just been removed from the public projections.
CALL add_column_if_missing('users', 'full_name_bn',     @vc);
CALL add_column_if_missing('users', 'role_bn',          @vc);
CALL add_column_if_missing('users', 'bio_bn',           @txt);
CALL add_column_if_missing('users', 'skills_bn',        @vc);
CALL add_column_if_missing('users', 'location_bn',      @vc);
CALL add_column_if_missing('users', 'interested_in_bn', @vc);
CALL add_column_if_missing('users', 'education_bn',     @vc);

-- ---------------------------------------------------------------------------
-- Partner additional info
-- ---------------------------------------------------------------------------
CALL add_column_if_missing('partner_additional_info', 'livelihood_activity_bn', @vc);
CALL add_column_if_missing('partner_additional_info', 'primary_goal_bn',        @vc);

DROP PROCEDURE IF EXISTS add_column_if_missing;

-- ---------------------------------------------------------------------------
-- Verify
-- ---------------------------------------------------------------------------
--   SELECT TABLE_NAME, COLUMN_NAME
--   FROM information_schema.COLUMNS
--   WHERE TABLE_SCHEMA = DATABASE() AND COLUMN_NAME LIKE '%\_bn'
--   ORDER BY TABLE_NAME, COLUMN_NAME;
--
-- Expect 22 rows: projects 5, project_categories 1, blogs 2,
-- investor_testimonials 2, partnerships 1, app_stat_panel 2, users 7,
-- partner_additional_info 2.
