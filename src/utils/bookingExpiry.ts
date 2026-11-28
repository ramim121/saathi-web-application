import { QueryTypes, type Transaction } from 'sequelize';
import sequelize from '@/config/db';
import { DB_NAME, SYSTEM_USER_ID } from '@/config/constants';
import { ProjectInvestmentBooking, ProjectInvestor, User } from '@/models/__associations';
import BookingStatusEntry from '@/utils/BookingStatusEntry';
import ProjectInvestorStatusEntry from '@/utils/ProjectInvestorStatusEntry';
import { undoReinvestment } from '@/utils/reinvestmentServer';
import { generateNotification } from '@/notifications';
import { PAYMENT_WINDOW_DAYS } from '@/utils/bookingHolds';
import { formatDue, formatDueDay, isAwaitingPayment, launchDueDate, remindersDue } from '@/utils/bookingHoldsShared';

/**
 * The payment-window job (plan 4.4), run by POST api/cron/booking-holds from
 * the server's crontab:
 *
 *   1. one run at a time per database (a MySQL advisory lock);
 *   2. reminders: 10:00 Dhaka two days before the deadline and on the last
 *      day, for bookings awaiting payment;
 *   3. expiry: a booking still awaiting payment after its deadline is
 *      cancelled (cancel_reason 'expired'), its booked lines are cancelled, a
 *      reinvestment gives its money back to the matured line, and the
 *      investor is told. Each booking in its own transaction, its row locked
 *      and re-checked first.
 *
 * A booking under review never expires (decision 1), and a booking with no
 * stored deadline is never touched: the backfill sets those first.
 *
 * The hold rule already stops an expired booking from holding units the
 * moment its deadline passes, so a late or missed run never makes capacity
 * wrong. The job makes it official and tells people.
 */

type Row = Record<string, unknown>;
const num = (v: unknown) => Number(v ?? 0) || 0;
const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null);

export type HoldsReport = {
    now: string;
    dryRun: boolean;
    onlyBooking: number | null;
    reminded: { id: number; bookingId: string; idUsers: number; dueAt: string | null; reminder: number }[];
    expired: { id: number; bookingId: string; idUsers: number; dueAt: string | null; units: number; reinvestment: boolean }[];
    unitsReleased: number;
    /** Open unpaid bookings with no stored deadline: the backfill has not run for them. */
    withoutDeadline: number;
    errors: { id: number; message: string }[];
    warnings: string[];
};

/** The System admin account recorded as the actor; null when not configured. */
export async function systemUser(): Promise<{ idUsers: number } | null> {
    if (!SYSTEM_USER_ID) return null;
    const user = (await User.findByPk(SYSTEM_USER_ID, { attributes: ['idUsers', 'userType'] })) as any;
    return user && user.userType === 'admin' ? { idUsers: Number(user.idUsers) } : null;
}

/**
 * Runs `fn` holding a server-wide advisory lock named for this database, so
 * staging and production (same RDS host) never block each other, and two runs
 * on one database never overlap. Returns null when another run holds it.
 */
export async function withJobLock<T>(name: string, fn: () => Promise<T>): Promise<T | null> {
    const lockName = `${name}:${DB_NAME}`;
    const holder = await sequelize.transaction();
    try {
        const [row] = await sequelize.query<{ got: unknown }>('SELECT GET_LOCK(:lockName, 0) AS got', {
            replacements: { lockName },
            type: QueryTypes.SELECT,
            transaction: holder,
        });
        if (num(row?.got) !== 1) {
            await holder.rollback();
            return null;
        }
        try {
            return await fn();
        } finally {
            await sequelize.query('SELECT RELEASE_LOCK(:lockName)', { replacements: { lockName }, type: QueryTypes.SELECT, transaction: holder }).catch(() => undefined);
        }
    } finally {
        await holder.commit().catch(() => undefined);
    }
}

/** Open bookings awaiting payment with a stored deadline, with their booked units. */
async function awaitingBookings(where: string, now: Date, onlyBooking: number | null): Promise<Row[]> {
    return sequelize.query<Row>(
        `SELECT b.id_project_investment_bookings AS id, b.booking_id AS bookingId, b.id_users AS idUsers,
                b.payment_due_at AS dueAt, b.payment_reminders_sent AS sent, b.booking_type AS bookingType,
                (SELECT IFNULL(SUM(pi.unit_purchased), 0) FROM project_investors pi
                  WHERE pi.id_project_investment_bookings = b.id_project_investment_bookings AND pi.investment_status = 'booked') AS units
           FROM project_investment_bookings b
          WHERE b.cancelled = 'no'
            AND b.payment_confirmation_status IN ('pending', 'denied')
            AND b.payment_due_at IS NOT NULL
            AND ${where}
            ${onlyBooking ? 'AND b.id_project_investment_bookings = :onlyBooking' : ''}
          ORDER BY b.payment_due_at, b.id_project_investment_bookings`,
        { replacements: { now, onlyBooking }, type: QueryTypes.SELECT },
    );
}

async function notify(name: string, idUsers: number, data: Record<string, unknown>) {
    try {
        const user = await User.findByPk(idUsers);
        if (user) await generateNotification(name, { fullName: user.fullName, ...data }, user);
    } catch (err) {
        console.error(`[booking-holds] ${name} for user ${idUsers} failed:`, (err as Error).message);
    }
}

/** Locks one booking and re-reads it; null if it no longer matches. */
async function lockAwaiting(id: number, now: Date, transaction: Transaction, mustBeDue: boolean) {
    const booking = (await ProjectInvestmentBooking.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE })) as any;
    if (!booking || booking.cancelled !== 'no' || !isAwaitingPayment(booking.paymentConfirmationStatus) || !booking.paymentDueAt) return null;
    const due = new Date(booking.paymentDueAt);
    if (mustBeDue ? due.getTime() > now.getTime() : due.getTime() <= now.getTime()) return null;
    return booking;
}

export async function runBookingHolds(opts: { now: Date; dryRun: boolean; actorId: number | null; onlyBooking?: number | null }): Promise<HoldsReport> {
    const { now, dryRun, actorId } = opts;
    const onlyBooking = opts.onlyBooking ?? null;
    const report: HoldsReport = { now: now.toISOString(), dryRun, onlyBooking, reminded: [], expired: [], unitsReleased: 0, withoutDeadline: 0, errors: [], warnings: [] };
    if (!actorId) report.warnings.push('SYSTEM_USER_ID is not set to an admin account: a live run would refuse to change anything.');

    const [missing] = await sequelize.query<{ n: unknown }>(
        `SELECT COUNT(*) AS n FROM project_investment_bookings
          WHERE cancelled = 'no' AND payment_confirmation_status <> 'confirmed' AND payment_due_at IS NULL`,
        { type: QueryTypes.SELECT },
    );
    report.withoutDeadline = num(missing?.n);

    // Reminders: bookings still within their deadline.
    for (const r of await awaitingBookings('b.payment_due_at > :now', now, onlyBooking)) {
        const due = new Date(r.dueAt as string);
        const k = remindersDue(due, now);
        if (k <= num(r.sent) || num(r.units) <= 0) continue;
        const item = { id: num(r.id), bookingId: String(r.bookingId ?? ''), idUsers: num(r.idUsers), dueAt: iso(r.dueAt), reminder: k };
        if (dryRun) {
            report.reminded.push(item);
            continue;
        }
        const transaction = await sequelize.transaction();
        try {
            const booking = await lockAwaiting(item.id, now, transaction, false);
            if (!booking || remindersDue(new Date(booking.paymentDueAt), now) <= num(booking.paymentRemindersSent)) {
                await transaction.rollback();
                continue;
            }
            booking.paymentRemindersSent = remindersDue(new Date(booking.paymentDueAt), now);
            await booking.save({ transaction });
            await transaction.commit();
        } catch (err) {
            await transaction.rollback().catch(() => undefined);
            report.errors.push({ id: item.id, message: (err as Error).message });
            continue;
        }
        report.reminded.push(item);
        await notify('booking_payment_reminder', item.idUsers, { bookingId: item.bookingId, paymentDueAt: item.dueAt, dueText: formatDue(due) });
    }

    // Expiry: bookings past their deadline.
    for (const r of await awaitingBookings('b.payment_due_at <= :now', now, onlyBooking)) {
        const item = {
            id: num(r.id),
            bookingId: String(r.bookingId ?? ''),
            idUsers: num(r.idUsers),
            dueAt: iso(r.dueAt),
            units: num(r.units),
            reinvestment: r.bookingType === 'reinvestment',
        };
        if (dryRun) {
            report.expired.push(item);
            report.unitsReleased += item.units;
            continue;
        }
        if (!actorId) break;
        const transaction = await sequelize.transaction();
        let units = 0;
        try {
            const booking = await lockAwaiting(item.id, now, transaction, true);
            if (!booking) {
                await transaction.rollback();
                continue;
            }
            const dueDay = formatDueDay(booking.paymentDueAt);
            booking.cancelled = 'yes';
            booking.cancelReason = 'expired';
            booking.cancelledAt = new Date();
            booking.cancelledBy = actorId;
            await booking.save({ transaction });

            const lines = await ProjectInvestor.findAll({
                where: { idProjectInvestmentBookings: booking.idProjectInvestmentBookings, investmentStatus: 'booked' },
                transaction,
            });
            for (const line of lines) {
                line.investmentStatus = 'cancelled';
                await line.save({ transaction });
                await ProjectInvestorStatusEntry('cancelled', line.idProjectInvestors as number, actorId, `Booking expired: no proof of payment by ${dueDay}`, transaction);
                units += num(line.unitPurchased);
            }
            await BookingStatusEntry('expired', booking.idProjectInvestmentBookings, actorId, `No proof of payment by ${dueDay}. Units released.`, transaction);
            // A reinvestment's money goes back to the matured line, as on a manual cancel.
            await undoReinvestment(booking, actorId, transaction);
            await transaction.commit();
        } catch (err) {
            await transaction.rollback().catch(() => undefined);
            report.errors.push({ id: item.id, message: (err as Error).message });
            continue;
        }
        item.units = units;
        report.expired.push(item);
        report.unitsReleased += units;
        await notify('booking_expired', item.idUsers, { bookingId: item.bookingId, paymentDueAt: item.dueAt, dueText: item.dueAt ? formatDue(item.dueAt) : '' });
    }
    return report;
}

export type BackfillReport = {
    now: string;
    dryRun: boolean;
    bookings: { id: number; bookingId: string; idUsers: number; status: string; createdAt: string | null; dueAt: string; notice: boolean }[];
    notified: { idUsers: number; bookings: string[]; dueAt: string }[];
    errors: { idUsers: number; message: string }[];
};

/**
 * Decision 3: every open unpaid booking with no stored deadline gets the
 * later of its natural deadline and the end of launch day + 2 (Dhaka), in
 * one transaction. Then each investor with a booking awaiting payment gets
 * ONE notice listing their bookings. Bookings under review get a deadline too
 * (it matters if their receipt is rejected) but no notice: they do not expire.
 * Safe to re-run: only rows still without a deadline are touched.
 */
export async function runBackfill(opts: { now: Date; dryRun: boolean; onlyBooking?: number | null }): Promise<BackfillReport> {
    const { now, dryRun } = opts;
    const onlyBooking = opts.onlyBooking ?? null;
    const report: BackfillReport = { now: now.toISOString(), dryRun, bookings: [], notified: [], errors: [] };
    const rows = await sequelize.query<Row>(
        `SELECT b.id_project_investment_bookings AS id, b.booking_id AS bookingId, b.id_users AS idUsers,
                b.payment_confirmation_status AS status, b.created_at AS createdAt,
                EXISTS (SELECT 1 FROM project_investors pi
                         WHERE pi.id_project_investment_bookings = b.id_project_investment_bookings AND pi.investment_status = 'booked') AS hasBooked
           FROM project_investment_bookings b
          WHERE b.cancelled = 'no' AND b.payment_confirmation_status <> 'confirmed' AND b.payment_due_at IS NULL
            ${onlyBooking ? 'AND b.id_project_investment_bookings = :onlyBooking' : ''}
          ORDER BY b.id_users, b.created_at`,
        { replacements: { onlyBooking }, type: QueryTypes.SELECT },
    );
    for (const r of rows) {
        const due = launchDueDate(new Date(r.createdAt as string), now, PAYMENT_WINDOW_DAYS);
        report.bookings.push({
            id: num(r.id),
            bookingId: String(r.bookingId ?? ''),
            idUsers: num(r.idUsers),
            status: String(r.status ?? ''),
            createdAt: iso(r.createdAt),
            dueAt: due.toISOString(),
            notice: isAwaitingPayment(String(r.status ?? '')) && num(r.hasBooked) > 0,
        });
    }

    if (!dryRun && report.bookings.length) {
        const transaction = await sequelize.transaction();
        try {
            for (const b of report.bookings) {
                const due = new Date(b.dueAt);
                // The launch notice stands in for any reminder already due, so
                // the job does not send one on top of it straight away.
                await sequelize.query(
                    `UPDATE project_investment_bookings SET payment_due_at = :due, payment_reminders_sent = :sent
                      WHERE id_project_investment_bookings = :id AND payment_due_at IS NULL`,
                    { replacements: { due, sent: remindersDue(due, now), id: b.id }, type: QueryTypes.UPDATE, transaction },
                );
            }
            await transaction.commit();
        } catch (err) {
            await transaction.rollback().catch(() => undefined);
            throw err;
        }
    }

    // One notice per investor.
    const byUser = new Map<number, { bookingId: string; dueAt: string }[]>();
    for (const b of report.bookings.filter((x) => x.notice)) {
        const list = byUser.get(b.idUsers) ?? [];
        list.push({ bookingId: b.bookingId, dueAt: b.dueAt });
        byUser.set(b.idUsers, list);
    }
    byUser.forEach((list, idUsers) => {
        const earliest = list.map((x) => x.dueAt).sort()[0];
        report.notified.push({ idUsers, bookings: list.map((x) => x.bookingId), dueAt: earliest });
    });
    if (!dryRun) {
        for (const n of report.notified) {
            const list = byUser.get(n.idUsers) ?? [];
            try {
                await notify('booking_payment_window_notice', n.idUsers, {
                    bookings: list.map((x) => ({ bookingId: x.bookingId, paymentDueAt: x.dueAt })),
                    bookingList: n.bookings.join(', '),
                    paymentDueAt: n.dueAt,
                    dueText: formatDue(n.dueAt),
                });
            } catch (err) {
                report.errors.push({ idUsers: n.idUsers, message: (err as Error).message });
            }
        }
    }
    return report;
}
