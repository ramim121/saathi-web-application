-- 012_notification_copy.sql
--
-- Corrects the SMS and push copy held in `notification_templates`.
--
-- WHY THESE FOUR
-- Every change below is a defect, not a preference. SMS is the channel that
-- reaches people who never open email, and it is the one nobody had reviewed.
--
--   1. booking_cancelled asserted a reason we do not always know. It told
--      everyone their booking was cancelled "due to failure to submit proof of
--      payment in due time" — including investors who cancelled it themselves.
--      Telling somebody they missed a deadline they did not miss is worse than
--      saying less.
--
--   2. Two typos went out with every message: "You booking" (booking_cancelled)
--      and "My investesments" (booking_active).
--
--   3. project_maturity_1_week's push title is "? Reinvest & Grow". That "?" is
--      a mojibaked emoji — the character was mangled somewhere between the
--      editor and the column, and has been arriving as a literal question mark.
--      Replaced with text that needs no emoji to make sense.
--
--   4. booking_placed's SMS says "within next 3 days" with no space and reads
--      as one run-on sentence on a phone.
--
-- WHAT IS DELIBERATELY NOT CHANGED
--   The `${data.x}` placeholders. They are interpolated by `eval()` in
--   `generateNotificationBody`, and renaming one here without changing the
--   caller renders the literal text "undefined" into a live SMS.
--
-- SAFE BEFORE THE APP RELEASE
--   Copy only. No column, no schema, no behaviour. The app displays none of
--   these strings — they are sent by the API.
--
-- APPLY
--   node db/migrate.mjs db/migrations/012_notification_copy.sql

START TRANSACTION;

UPDATE `notification_templates`
SET `sms_template` = 'Dear ${data.fullName}, your Shathi booking ${data.bookingId} has been cancelled and its units released. Nothing has been charged. Not expecting this? Write to info@digigramventures.com'
WHERE `notification_name` = 'booking_cancelled';

UPDATE `notification_templates`
SET `sms_template` = 'Great news! We have received your payment and your booking ${data.bookingId} is now active. You can see it in the Shathi app under My Investments.'
WHERE `notification_name` = 'booking_active';

UPDATE `notification_templates`
SET `sms_template` = 'Shathi booking ${data.bookingId} is placed. Please complete your payment as instructed, then submit proof within 3 days. The option is under My Investments.'
WHERE `notification_name` = 'booking_placed';

UPDATE `notification_templates`
SET `push_notification_title` = 'Reinvest and grow'
WHERE `notification_name` = 'project_maturity_1_week';

COMMIT;

-- Verify
--   SELECT notification_name, sms_template, push_notification_title
--     FROM notification_templates
--    WHERE notification_name IN
--      ('booking_cancelled','booking_active','booking_placed','project_maturity_1_week');
