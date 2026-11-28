import { BOOKING_PAYMENT_WINDOW_DAYS } from '@/config/constants';
import { bookingState, dueDateFor, effectiveDue, type BookingState } from '@/utils/bookingHoldsShared';

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
