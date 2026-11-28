import { effectiveDue, formatDueDay, isAwaitingPayment } from '@/utils/bookingHoldsShared';

/**
 * Whether a booking can take a payment receipt, for every upload route.
 *
 * A receipt cannot be attached to a booking that is finished one way or the
 * other. Both used to be accepted: a second upload flipped a *confirmed*
 * booking back to "proof submitted" and reset its collection fields, and a
 * *cancelled* booking (units already released) took a receipt, inviting a
 * second payment for nothing. A denied booking may upload again; that is how
 * an investor answers a rejected receipt.
 *
 * Past its payment deadline a booking no longer holds its units, which may
 * already be booked by someone else, so a late receipt is refused with
 * BOOKING_EXPIRED whether or not the expiry job has cancelled it yet. An
 * admin can move the deadline first (which checks the units are still free).
 */
export function receiptBlocked(
    booking: {
        cancelled?: string | null;
        cancelReason?: string | null;
        paymentConfirmationStatus?: string | null;
        paymentDueAt?: Date | string | null;
        createdAt?: Date | string | null;
    },
    now: Date = new Date(),
): { code: string; message: string } | null {
    const expiredMessage = () => {
        const due = effectiveDue(booking);
        return `This booking expired${due ? ` on ${formatDueDay(due)}` : ''}. Book again, or contact DigiGram if you have already paid.`;
    };
    if (booking.cancelled === 'yes') {
        if (booking.cancelReason === 'expired') return { code: 'BOOKING_EXPIRED', message: expiredMessage() };
        return { code: 'BOOKING_CANCELLED', message: 'This booking was cancelled, so it no longer takes a payment receipt.' };
    }
    if (booking.paymentConfirmationStatus === 'confirmed') {
        return { code: 'BOOKING_CONFIRMED', message: 'This booking is already confirmed. Contact DigiGram if its receipt needs to change.' };
    }
    if (isAwaitingPayment(booking.paymentConfirmationStatus)) {
        const due = effectiveDue(booking);
        if (due && due.getTime() <= now.getTime()) return { code: 'BOOKING_EXPIRED', message: expiredMessage() };
    }
    return null;
}
