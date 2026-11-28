import type { NextApiRequest, NextApiResponse } from 'next';
import { requireCron, withCors } from '@/utils/auth';
import { runBackfill, withJobLock } from '@/utils/bookingExpiry';
import { cronOptions } from '@/utils/cronOptions';
import startNotificationQueue from '@/notifications';

/**
 * POST api/cron/booking-holds/backfill — run ONCE per environment at launch
 * (decision 3). Gives every open unpaid booking without a deadline the later
 * of its natural deadline and the end of launch day + 2 (Dhaka time), then
 * sends each investor awaiting payment one notice. Same auth as the job.
 *
 *   ?dryRun=1          list the deadlines it would set and who would be told
 *   ?now=<ISO time>    launch time to use (staging only, as for the job)
 *
 * Re-running touches only bookings that still have no deadline.
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });
    const options = cronOptions(req);
    if ('error' in options) return res.status(400).json({ success: false, message: options.error });

    if (!options.dryRun) startNotificationQueue();
    try {
        // The same lock as the job: the job must not run between the deadlines
        // being written and the notices going out.
        const report = await withJobLock('booking_holds', () => runBackfill({ now: options.now, dryRun: options.dryRun, onlyBooking: options.onlyBooking }));
        if (!report) return res.status(409).json({ success: false, message: 'The booking-holds job is running. Try again in a minute.' });
        console.log(`[booking-holds backfill] ${report.dryRun ? 'DRY RUN ' : ''}now=${report.now} bookings=${report.bookings.length} notified=${report.notified.length} errors=${report.errors.length}`);
        return res.status(200).json({ success: true, data: report });
    } catch (err) {
        console.error('[booking-holds backfill] failed:', (err as Error).message);
        return res.status(500).json({ success: false, message: (err as Error).message });
    }
}

export default withCors(requireCron(handler));
