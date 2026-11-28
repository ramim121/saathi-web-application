/**
 * Payment-window rules that both the browser and the server use: dates,
 * reminders and the booking state shown to people. No server imports here,
 * pages import it. The SQL form of the hold rule is in `bookingHolds.ts`.
 *
 * All times are Date objects in UTC. Dhaka is UTC+6 all year (no daylight
 * saving), so "Dhaka time" is a fixed offset.
 *
 * See docs/booking-lifecycle-and-payment-window.md, section 4.
 */

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
export const DHAKA_OFFSET_MS = 6 * HOUR;

/** A receipt waiting this long for review is flagged on the admin dashboard. */
export const REVIEW_FLAG_HOURS = 48;
/** A rejected receipt leaves at least this long to send a new one. */
export const REJECTION_GRACE_HOURS = 48;
/** A failed cash/cheque collection leaves at least this long to pay. */
export const FAILED_COLLECTION_GRACE_HOURS = 48;
/** Bookings already open at launch get at least this many days (to the end of the day). */
export const LAUNCH_GRACE_DAYS = 2;
/** Reminders go out at this hour, Dhaka time. */
export const REMINDER_HOUR_DHAKA = 10;

export const REVIEW_STATUSES = ['uploaded', 'proof_submitted'] as const;
export const AWAITING_STATUSES = ['pending', 'denied'] as const;

export const isUnderReview = (status: string | null | undefined) => status === 'uploaded' || status === 'proof_submitted';
export const isAwaitingPayment = (status: string | null | undefined) => status === 'pending' || status === 'denied';

const toDate = (value: Date | string | number) => (value instanceof Date ? value : new Date(value));
const later = (a: Date, b: Date) => (a.getTime() >= b.getTime() ? a : b);

/** 23:59:59 Dhaka time on the day `plusDays` after `at`'s Dhaka date. */
export function endOfDhakaDay(at: Date | string, plusDays = 0): Date {
    const local = new Date(toDate(at).getTime() + DHAKA_OFFSET_MS);
    const end = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + plusDays, 23, 59, 59);
    return new Date(end - DHAKA_OFFSET_MS);
}

/** `hour`:00 Dhaka time on `at`'s Dhaka date, `plusDays` later. */
function atDhakaHour(at: Date, hour: number, plusDays = 0): Date {
    const local = new Date(at.getTime() + DHAKA_OFFSET_MS);
    return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + plusDays, hour, 0, 0) - DHAKA_OFFSET_MS);
}

/** The deadline of a booking made at `createdAt`: end of the Nth day after it, Dhaka time. */
export function dueDateFor(createdAt: Date | string, windowDays: number): Date {
    return endOfDhakaDay(createdAt, windowDays);
}

/** Decision 3: a booking open at launch keeps its natural deadline, but no earlier than the end of launch day + 2. */
export function launchDueDate(createdAt: Date | string, launchAt: Date | string, windowDays: number): Date {
    return later(dueDateFor(createdAt, windowDays), endOfDhakaDay(launchAt, LAUNCH_GRACE_DAYS));
}

/** Decision 5: after a rejected receipt, the later of the current deadline and 48 h after the rejection. */
export function dueAfterRejection(currentDue: Date | string | null | undefined, rejectedAt: Date | string, fallbackDue: Date): Date {
    const grace = new Date(toDate(rejectedAt).getTime() + REJECTION_GRACE_HOURS * HOUR);
    return later(currentDue ? toDate(currentDue) : fallbackDue, grace);
}

/** A failed collection: back to awaiting payment, with at least 48 h. */
export function dueAfterFailedCollection(currentDue: Date | string | null | undefined, failedAt: Date | string, fallbackDue: Date): Date {
    const grace = new Date(toDate(failedAt).getTime() + FAILED_COLLECTION_GRACE_HOURS * HOUR);
    return later(currentDue ? toDate(currentDue) : fallbackDue, grace);
}

/**
 * Decision 6: 10:00 Dhaka two days before the deadline's day, and 10:00 on
 * that day. A reminder time at or after the deadline is dropped (a deadline
 * moved to early morning by a rejection has no "last day" reminder).
 */
export function reminderTimes(due: Date | string): Date[] {
    const d = toDate(due);
    return [atDhakaHour(d, REMINDER_HOUR_DHAKA, -2), atDhakaHour(d, REMINDER_HOUR_DHAKA, 0)].filter((t) => t.getTime() < d.getTime());
}

/** How many reminders should have gone out by `now` (0, 1 or 2). */
export function remindersDue(due: Date | string, now: Date): number {
    const all = reminderTimes(due);
    // Index of the latest reminder time passed, +1. Two reminders whose times
    // have both passed count as 2, but the job sends only the latest one.
    let count = 0;
    all.forEach((t, i) => {
        if (t.getTime() <= now.getTime()) count = i + 1;
    });
    return Math.min(count, 2);
}

/**
 * The deadline a booking runs to, or null when it has none stored.
 *
 * A booking with no stored deadline was open before migration 017 and has not
 * been backfilled yet. It has NO deadline until the backfill gives it one
 * (decision 3: at least launch day + 2), so it keeps holding its units and
 * can still take a receipt. Treating it as due N days after it was made (the
 * plan's first draft) would refuse receipts from those investors in the hours
 * between the deploy and the backfill.
 */
export function effectiveDue(b: { paymentDueAt?: Date | string | null }): Date | null {
    return b.paymentDueAt ? toDate(b.paymentDueAt) : null;
}

/**
 * One state per booking, derived from the existing columns (plan 5.1), so
 * nothing stored changes meaning. `expired` covers both a booking the job has
 * cancelled and one whose deadline has passed before the job got to it: it no
 * longer holds its units either way.
 */
export type BookingState = 'awaiting_payment' | 'receipt_rejected' | 'under_review' | 'confirmed' | 'expired' | 'cancelled';

export function bookingState(
    b: {
        paymentConfirmationStatus?: string | null;
        cancelled?: string | null;
        cancelReason?: string | null;
        paymentDueAt?: Date | string | null;
    },
    now: Date = new Date(),
): BookingState {
    if (b.cancelled === 'yes') return b.cancelReason === 'expired' ? 'expired' : 'cancelled';
    if (b.paymentConfirmationStatus === 'confirmed') return 'confirmed';
    if (isUnderReview(b.paymentConfirmationStatus)) return 'under_review';
    const due = effectiveDue(b);
    if (due && due.getTime() <= now.getTime()) return 'expired';
    return b.paymentConfirmationStatus === 'denied' ? 'receipt_rejected' : 'awaiting_payment';
}

export const BOOKING_STATE_LABEL: Record<BookingState, string> = {
    awaiting_payment: 'Awaiting payment',
    receipt_rejected: 'Receipt rejected',
    under_review: 'Receipt under review',
    confirmed: 'Confirmed',
    expired: 'Expired',
    cancelled: 'Cancelled',
};

/** Whole hours from `since` to `now` (0 when unknown). */
export function hoursSince(since: Date | string | null | undefined, now: Date = new Date()): number {
    if (!since) return 0;
    return Math.max(0, Math.floor((now.getTime() - toDate(since).getTime()) / HOUR));
}

/** "2 days 4 h", "5 h", "40 min" until `due`; "" once it has passed. */
export function timeLeft(due: Date | string | null | undefined, now: Date = new Date()): string {
    if (!due) return '';
    const ms = toDate(due).getTime() - now.getTime();
    if (ms <= 0) return '';
    const days = Math.floor(ms / DAY);
    const hours = Math.floor((ms % DAY) / HOUR);
    if (days > 0) return `${days} day${days === 1 ? '' : 's'}${hours ? ` ${hours} h` : ''}`;
    if (hours > 0) return `${hours} h`;
    return `${Math.max(1, Math.floor(ms / 60000))} min`;
}

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_BN = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
const bnDigits = (value: string | number) => String(value).replace(/[0-9]/g, (d) => '০১২৩৪৫৬৭৮৯'[Number(d)]);

function bnPeriod(hour: number): string {
    if (hour < 4) return 'রাত';
    if (hour < 12) return 'সকাল';
    if (hour < 15) return 'দুপুর';
    if (hour < 18) return 'বিকাল';
    if (hour < 20) return 'সন্ধ্যা';
    return 'রাত';
}

/** "2 Dec, 11:59 PM" in Dhaka time; Bangla: "২ ডিসেম্বর, রাত ১১:৫৯". */
export function formatDue(due: Date | string, locale: 'en' | 'bn' = 'en'): string {
    const local = new Date(toDate(due).getTime() + DHAKA_OFFSET_MS);
    const day = local.getUTCDate();
    const month = local.getUTCMonth();
    const h24 = local.getUTCHours();
    const mm = String(local.getUTCMinutes()).padStart(2, '0');
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    if (locale === 'bn') return `${bnDigits(day)} ${MONTHS_BN[month]}, ${bnPeriod(h24)} ${bnDigits(h12)}:${bnDigits(mm)}`;
    return `${day} ${MONTHS_EN[month]}, ${h12}:${mm} ${h24 < 12 ? 'AM' : 'PM'}`;
}

/** "2 Dec 2026" in Dhaka time, for history remarks. */
export function formatDueDay(due: Date | string): string {
    const local = new Date(toDate(due).getTime() + DHAKA_OFFSET_MS);
    return `${local.getUTCDate()} ${MONTHS_EN[local.getUTCMonth()]} ${local.getUTCFullYear()}`;
}
