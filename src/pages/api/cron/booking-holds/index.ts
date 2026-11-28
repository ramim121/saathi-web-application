import type { NextApiRequest, NextApiResponse } from 'next';
import { requireCron, withCors } from '@/utils/auth';
import { runBookingHolds, systemUser, withJobLock } from '@/utils/bookingExpiry';
import { cronOptions } from '@/utils/cronOptions';
import startNotificationQueue from '@/notifications';

/**
 * POST api/cron/booking-holds — payment reminders and expiry of unpaid
 * bookings (utils/bookingExpiry.ts). Run every 10 minutes from the server's
 * crontab with `Authorization: Bearer $CRON_SECRET`.
 *
 *   ?dryRun=1          report what would happen, change and send nothing
 *   ?now=<ISO time>    act as if it were that time (only where
 *                      CRON_ALLOW_NOW_OVERRIDE=true, i.e. staging)
 *
 * Answers { reminded, expired, unitsReleased, ... }. Idempotent: a booking is
 * reminded or expired once, and two runs never overlap.
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });
    const options = cronOptions(req);
    if ('error' in options) return res.status(400).json({ success: false, message: options.error });

    const actor = await systemUser();
    if (!actor && !options.dryRun) {
        return res.status(503).json({ success: false, message: 'SYSTEM_USER_ID must name an admin account before this job changes anything. A dry run (?dryRun=1) works without it.' });
    }

    // Notifications are sent by the queue loop. Until now it started only when
    // an admin opened the dashboard after a restart (plan P13); start it here
    // too. It runs once per process however often this is called.
    if (!options.dryRun) startNotificationQueue();

    try {
        const report = await withJobLock('booking_holds', () => runBookingHolds({ now: options.now, dryRun: options.dryRun, actorId: actor?.idUsers ?? null, onlyBooking: options.onlyBooking }));
        if (!report) return res.status(409).json({ success: false, message: 'Another run is in progress.' });
        console.log(
            `[booking-holds] ${report.dryRun ? 'DRY RUN ' : ''}now=${report.now} reminded=${report.reminded.length} expired=${report.expired.length} ` +
                `unitsReleased=${report.unitsReleased} withoutDeadline=${report.withoutDeadline} errors=${report.errors.length}`,
        );
        return res.status(200).json({ success: true, data: report });
    } catch (err) {
        console.error('[booking-holds] failed:', (err as Error).message);
        return res.status(500).json({ success: false, message: (err as Error).message });
    }
}

export default withCors(requireCron(handler));
