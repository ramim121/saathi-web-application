import type { NextApiRequest } from 'next';
import { CRON_ALLOW_NOW_OVERRIDE } from '@/config/constants';

/**
 * `?dryRun=1`, `?now=<ISO time>` and `?booking=<id>` for the cron routes.
 *
 * `now` is accepted only where CRON_ALLOW_NOW_OVERRIDE=true (staging), so
 * production always acts on the real time. `booking` (an internal
 * id_project_investment_bookings) limits a run to one booking, so a test with
 * a future `now` does not expire every other booking on the staging copy.
 */
export function cronOptions(req: NextApiRequest): { now: Date; dryRun: boolean; onlyBooking: number | null } | { error: string } {
    const flag = String(req.query.dryRun ?? '').toLowerCase();
    const dryRun = flag === '1' || flag === 'true' || flag === 'yes';
    let onlyBooking: number | null = null;
    if (req.query.booking !== undefined && req.query.booking !== '') {
        onlyBooking = Number(req.query.booking);
        if (!Number.isInteger(onlyBooking) || onlyBooking <= 0) return { error: '?booking= must be a booking id (a whole number).' };
    }
    const raw = req.query.now;
    if (raw === undefined || raw === '') return { now: new Date(), dryRun, onlyBooking };
    if (!CRON_ALLOW_NOW_OVERRIDE) return { error: '?now= is only accepted where CRON_ALLOW_NOW_OVERRIDE=true (staging).' };
    const now = new Date(String(raw));
    if (Number.isNaN(now.getTime())) return { error: `?now= is not a date: ${String(raw)}` };
    return { now, dryRun, onlyBooking };
}
