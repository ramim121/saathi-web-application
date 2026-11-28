import { literal } from 'sequelize';
import { BOOKING_PAYMENT_WINDOW_DAYS } from '@/config/constants';
import { REVIEW_FLAG_HOURS, bookingState, dueDateFor, effectiveDue, type BookingState } from '@/utils/bookingHoldsShared';

/**
 * THE rule for "this line uses capacity" (plan 4.1). Every query that counts
 * units taken or left, and every route that books, confirms or moves units,
 * uses it from here, so they cannot disagree.
 *
 * A line uses capacity when it is paid (`confirmed`), or it is `booked`, its
 * booking is not cancelled, and the booking is still holding: its receipt is
 * under review, or its payment deadline has not passed. The deadline is part
 * of the rule, so an expired booking stops blocking anyone the moment it
 * passes, whether or not the expiry job has run. The job only makes it
 * official (cancels, frees the rows, notifies).
 *
 * A booking with no stored deadline (made before migration 017 and not yet
 * backfilled) runs to the end of the Nth day after it was made, Dhaka time,
 * the same as a new one. Deadlines are compared with UTC_TIMESTAMP(), since
 * every column is stored in UTC.
 *
 * Only constant SQL is built here: aliases are code, and the window is an
 * integer checked at boot.
 */

export const PAYMENT_WINDOW_DAYS = BOOKING_PAYMENT_WINDOW_DAYS;

/** Deadline for a booking made now (or at `createdAt`). */
export const newBookingDueDate = (createdAt: Date = new Date()) => dueDateFor(createdAt, PAYMENT_WINDOW_DAYS);

/** The booking's deadline as SQL, with the same fallback as `effectiveDue`. */
export function dueSql(b = 'b'): string {
    return `COALESCE(${b}.payment_due_at, TIMESTAMP(DATE(${b}.created_at + INTERVAL 6 HOUR) + INTERVAL ${PAYMENT_WINDOW_DAYS} DAY, '23:59:59') - INTERVAL 6 HOUR)`;
}

/** SQL: the booking `b` is holding its units right now (not cancelled; under review or within its deadline). */
export function bookingHoldingSql(b = 'b'): string {
    return `(${b}.cancelled = 'no' AND (${b}.payment_confirmation_status IN ('uploaded', 'proof_submitted') OR ${dueSql(b)} > UTC_TIMESTAMP()))`;
}

/** SQL: line `pi` is booked and held by its booking `b` (unpaid, but counting). */
export function heldSql(pi = 'pi', b = 'b'): string {
    return `(${pi}.investment_status = 'booked' AND ${bookingHoldingSql(b)})`;
}

/** SQL: line `pi` (booking `b`) uses capacity right now: paid or held. */
export function usesCapacity(pi = 'pi', b = 'b'): string {
    return `(${pi}.investment_status = 'confirmed' OR ${heldSql(pi, b)})`;
}

export type UnitsKind = 'used' | 'held' | 'paid';

const predicate = (kind: UnitsKind) =>
    kind === 'paid' ? `h_pi.investment_status = 'confirmed'` : kind === 'held' ? heldSql('h_pi', 'h_b') : usesCapacity('h_pi', 'h_b');

/**
 * Correlated subquery: units in the project `projectRef` (an SQL column, e.g.
 * `Project.id_projects`) that are used, held, or paid.
 *
 * LEFT JOIN, so a line with no booking row still counts when it is paid.
 */
export function projectUnitsSql(projectRef: string, kind: UnitsKind): string {
    return `(SELECT IFNULL(SUM(h_pi.unit_purchased), 0)
               FROM project_investors AS h_pi
               LEFT JOIN project_investment_bookings AS h_b ON h_b.id_project_investment_bookings = h_pi.id_project_investment_bookings
              WHERE h_pi.id_projects = ${projectRef} AND ${predicate(kind)})`;
}

/** Correlated subquery: units with the project partner `partnerRef` (e.g. `ProjectPartners.id_project_partners`). */
export function partnerUnitsSql(partnerRef: string, kind: UnitsKind): string {
    return `(SELECT IFNULL(SUM(h_ppi.invested_unit), 0)
               FROM project_partner_investors AS h_ppi
               JOIN project_investors AS h_pi ON h_pi.id_project_investors = h_ppi.id_project_investors
               LEFT JOIN project_investment_bookings AS h_b ON h_b.id_project_investment_bookings = h_pi.id_project_investment_bookings
              WHERE h_ppi.id_project_partners = ${partnerRef} AND ${predicate(kind)})`;
}

/**
 * "Units left" as the shipped app expects it: NULL only when the project has
 * no total (0 = no limit), as the routes returned before.
 */
export function projectRemainingSql(projectRef: string, totalRef: string): string {
    return `CASE WHEN ${totalRef} != 0 THEN GREATEST(0, ${totalRef} - ${projectUnitsSql(projectRef, 'used')}) ELSE NULL END`;
}

/**
 * When the receipt now under review was sent: the latest upload in the
 * booking's history, or the row's last change when no upload was recorded
 * (bookings written by hand).
 */
export function receiptSinceSql(b = 'b'): string {
    return `COALESCE((SELECT MAX(h_s.created_at) FROM project_investment_booking_status AS h_s
                       WHERE h_s.id_project_investment_bookings = ${b}.id_project_investment_bookings
                         AND h_s.status = 'proof_of_payment_uploaded'), ${b}.updated_at)`;
}

/** Admin list filters for the payment window. */
export const HOLD_FILTERS = ['review', 'review_48h', 'expiring_24h', 'expired'] as const;
export type HoldFilter = (typeof HOLD_FILTERS)[number];

/** SQL for one admin list filter on booking alias `b`. */
export function holdFilterSql(filter: HoldFilter, b = 'b'): string {
    const review = `${b}.cancelled = 'no' AND ${b}.payment_confirmation_status IN ('uploaded', 'proof_submitted')`;
    const awaiting = `${b}.cancelled = 'no' AND ${b}.payment_confirmation_status IN ('pending', 'denied')`;
    switch (filter) {
        case 'review':
            return `(${review})`;
        case 'review_48h':
            return `(${review} AND ${receiptSinceSql(b)} <= UTC_TIMESTAMP() - INTERVAL ${REVIEW_FLAG_HOURS} HOUR)`;
        case 'expiring_24h':
            return `(${awaiting} AND ${dueSql(b)} > UTC_TIMESTAMP() AND ${dueSql(b)} <= UTC_TIMESTAMP() + INTERVAL 24 HOUR)`;
        case 'expired':
            // Cancelled by the job, or past the deadline and not swept yet.
            return `((${b}.cancelled = 'yes' AND ${b}.cancel_reason = 'expired') OR (${awaiting} AND ${dueSql(b)} <= UTC_TIMESTAMP()))`;
    }
}

type Attr = [ReturnType<typeof literal>, string];

/**
 * Unit fields for a project in a Sequelize `attributes.include`:
 * `totalInvestedUnits` (paid, as before), `totalRemainingUnits` (now total −
 * paid − held), and `paidUnits`, `reservedUnits`, `availableUnits`.
 */
export function projectUnitAttributes(opts: { remaining?: boolean; projectRef?: string; totalRef?: string } = {}): Attr[] {
    const projectRef = opts.projectRef ?? 'Project.id_projects';
    const totalRef = opts.totalRef ?? 'Project.total_available_units';
    const attrs: Attr[] = [
        [literal(projectUnitsSql(projectRef, 'paid')), 'totalInvestedUnits'],
        [literal(projectUnitsSql(projectRef, 'paid')), 'paidUnits'],
        [literal(projectUnitsSql(projectRef, 'held')), 'reservedUnits'],
    ];
    if (opts.remaining !== false) {
        attrs.push([literal(projectRemainingSql(projectRef, totalRef)), 'totalRemainingUnits']);
        attrs.push([literal(projectRemainingSql(projectRef, totalRef)), 'availableUnits']);
    }
    return attrs;
}

/** HAVING for lists that hide full projects; needs `projectUnitAttributes()` in the select. */
export const projectHasRoomHaving = () => literal('(totalAvailableUnits = 0 OR paidUnits + reservedUnits < totalAvailableUnits)');

/** Fields added to booking responses: the deadline and the derived state. */
export function holdFields(b: {
    paymentConfirmationStatus?: string | null;
    cancelled?: string | null;
    cancelReason?: string | null;
    paymentDueAt?: Date | string | null;
    createdAt?: Date | string | null;
}, now: Date = new Date()): { paymentDueAt: string | null; state: BookingState } {
    const due = b.paymentConfirmationStatus === 'confirmed' ? null : effectiveDue(b, PAYMENT_WINDOW_DAYS);
    return { paymentDueAt: due ? due.toISOString() : null, state: bookingState(b, PAYMENT_WINDOW_DAYS, now) };
}
