-- 017_booking_payment_window.sql
--
-- A payment deadline for bookings, and the notifications that go with it.
-- See docs/booking-lifecycle-and-payment-window.md (sections 4.2 to 4.6).
--
-- WHY
--   Unpaid bookings never expired, and "units left" counted paid units only,
--   so projects and partners were overbooked. A booked line now holds its
--   units while its booking is within `payment_due_at` (or its receipt is
--   under review). The expiry job cancels bookings with no receipt by then.
--
-- COLUMNS (project_investment_bookings)
--   payment_due_at          UTC. End of the 5th day after booking, Dhaka time.
--                           Set by the code when a booking is created, moved
--                           by a rejected receipt, a failed collection or an
--                           admin extension. NULL = not set yet (the backfill
--                           in POST api/cron/booking-holds/backfill sets the
--                           bookings that were open at launch).
--   payment_reminders_sent  how many of the two reminders went out (0, 1, 2).
--   cancel_reason           why a cancelled booking was cancelled. NULL for
--                           bookings cancelled before this migration.
--   cancelled_at / cancelled_by
--
-- NOTIFICATION TEMPLATES (inserted if missing)
--   booking_payment_reminder, booking_expired, booking_payment_window_notice.
--   booking_placed: the SMS and the push text no longer promise "3 days". They read the real
--   deadline, and falls back to plain text while older code (which does not
--   pass dueText) is still running, so applying this before the deploy is safe.
--
-- SAFE TO RUN ON A LIVE DATABASE
--   Every column is nullable or has a default, so existing rows and the
--   shipped app are unaffected. Nothing is backfilled here.
--
-- APPLY (each step guarded; safe to re-run)
--   node db/migrate.mjs db/migrations/017_booking_payment_window.sql --dry-run
--   node db/migrate.mjs db/migrations/017_booking_payment_window.sql
--
-- NOTE: the runner splits on semicolons, so no text below contains one.

-- payment_due_at
SET @exists := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'project_investment_bookings' AND COLUMN_NAME = 'payment_due_at'
);
SET @sql := IF(
    @exists = 0,
    'ALTER TABLE `project_investment_bookings` ADD COLUMN `payment_due_at` DATETIME NULL AFTER `payment_confirmation_status`',
    'SELECT ''payment_due_at already present, skipping'' AS note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- payment_reminders_sent
SET @exists := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'project_investment_bookings' AND COLUMN_NAME = 'payment_reminders_sent'
);
SET @sql := IF(
    @exists = 0,
    'ALTER TABLE `project_investment_bookings` ADD COLUMN `payment_reminders_sent` TINYINT NOT NULL DEFAULT 0 AFTER `payment_due_at`',
    'SELECT ''payment_reminders_sent already present, skipping'' AS note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- cancel_reason
SET @exists := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'project_investment_bookings' AND COLUMN_NAME = 'cancel_reason'
);
SET @sql := IF(
    @exists = 0,
    'ALTER TABLE `project_investment_bookings` ADD COLUMN `cancel_reason` ENUM(''investor'', ''admin'', ''expired'', ''reinvestment_undone'') NULL AFTER `cancelled`',
    'SELECT ''cancel_reason already present, skipping'' AS note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- cancelled_at
SET @exists := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'project_investment_bookings' AND COLUMN_NAME = 'cancelled_at'
);
SET @sql := IF(
    @exists = 0,
    'ALTER TABLE `project_investment_bookings` ADD COLUMN `cancelled_at` DATETIME NULL AFTER `cancel_reason`',
    'SELECT ''cancelled_at already present, skipping'' AS note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- cancelled_by
SET @exists := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'project_investment_bookings' AND COLUMN_NAME = 'cancelled_by'
);
SET @sql := IF(
    @exists = 0,
    'ALTER TABLE `project_investment_bookings` ADD COLUMN `cancelled_by` INT NULL AFTER `cancelled_at`',
    'SELECT ''cancelled_by already present, skipping'' AS note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- index for the hold rule and the expiry job
SET @exists := (
    SELECT COUNT(*) FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'project_investment_bookings' AND INDEX_NAME = 'idx_booking_holds'
);
SET @sql := IF(
    @exists = 0,
    'ALTER TABLE `project_investment_bookings` ADD KEY `idx_booking_holds` (`cancelled`, `payment_confirmation_status`, `payment_due_at`)',
    'SELECT ''idx_booking_holds already present, skipping'' AS note'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Notification templates. SMS and push text is evaluated as a template
-- literal with `data` in scope (see generateNotificationBody). The email body
-- comes from src/notifications/templates.ts, found by notification_name.

INSERT INTO `notification_templates`
    (`notification_name`, `sms_template`, `email_subject`, `email_template`, `push_notification_title`, `push_notification_template`)
SELECT
    'booking_payment_reminder',
    'Shathi: booking ${data.bookingId} is waiting for payment. Please pay and upload the receipt by ${data.dueText}, or the booking is cancelled and its units released.',
    'Booking ${data.bookingId}: pay by ${data.dueText}',
    'booking_payment_reminder',
    'Payment reminder',
    'Booking ${data.bookingId}: please pay and upload the receipt by ${data.dueText}.'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `notification_templates` WHERE `notification_name` = 'booking_payment_reminder');

INSERT INTO `notification_templates`
    (`notification_name`, `sms_template`, `email_subject`, `email_template`, `push_notification_title`, `push_notification_template`)
SELECT
    'booking_expired',
    'Shathi: booking ${data.bookingId} was not paid by ${data.dueText} and has been cancelled. Its units are released. If you have already paid, write to info@digigramventures.com.',
    'Booking ${data.bookingId} has expired',
    'booking_expired',
    'Booking expired',
    'Booking ${data.bookingId} was not paid by ${data.dueText} and has been cancelled.'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `notification_templates` WHERE `notification_name` = 'booking_expired');

INSERT INTO `notification_templates`
    (`notification_name`, `sms_template`, `email_subject`, `email_template`, `push_notification_title`, `push_notification_template`)
SELECT
    'booking_payment_window_notice',
    'Shathi: unpaid bookings now have a payment deadline. Booking ${data.bookingList}: please pay and upload the receipt by ${data.dueText}. Unpaid bookings are then cancelled and their units released.',
    'Your booking now has a payment deadline',
    'booking_payment_window_notice',
    'Payment deadline',
    'Booking ${data.bookingList}: please pay and upload the receipt by ${data.dueText}.'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM `notification_templates` WHERE `notification_name` = 'booking_payment_window_notice');

UPDATE `notification_templates`
SET `sms_template` = 'Shathi booking ${data.bookingId} is placed. Please complete your payment as instructed, then submit proof ${data.dueText ? "by " + data.dueText : "within 5 days"}. The option is under My Investments.'
WHERE `notification_name` = 'booking_placed';

UPDATE `notification_templates`
SET `push_notification_template` = 'Booking ${data.bookingId} is placed. Please complete your payment as instructed, then submit proof ${data.dueText ? "by " + data.dueText : "within 5 days"}. You can find the option under My Investments.'
WHERE `notification_name` = 'booking_placed';

-- Verify
--   SHOW COLUMNS FROM project_investment_bookings WHERE Field IN ('payment_due_at','payment_reminders_sent','cancel_reason','cancelled_at','cancelled_by')
--   SHOW INDEX FROM project_investment_bookings WHERE Key_name = 'idx_booking_holds'
--   SELECT notification_name, sms_template FROM notification_templates WHERE notification_name IN ('booking_placed','booking_payment_reminder','booking_expired','booking_payment_window_notice')
