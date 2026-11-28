import { NextApiRequest, NextApiResponse } from 'next';
import { ProjectInvestmentBooking } from '@/models/__associations';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '@/config/constants';
import JWTPayload from '@/types/JWTPayload';
import sequelize from '@/config/db';
import BookingStatusEntry from '@/utils/BookingStatusEntry';
import { isProofSubmitted } from '@/utils/bookingStatus';
import { newBookingDueDate } from '@/utils/bookingHolds';
import { dueAfterRejection, formatDue, remindersDue } from '@/utils/bookingHoldsShared';

/**
 * PUT api/bookings/deny — an admin rejects the receipt under review.
 *
 * Only a booking with a receipt waiting (uploaded / proof_submitted) can be
 * denied, and this route writes the status itself. It used to write whatever
 * `paymentConfirmationStatus` the request sent, with no check, so a call
 * could mark a booking `confirmed` past every confirmation check, or "deny"
 * one already confirmed. The body's value is now ignored.
 *
 * The investor then has until the later of the original deadline and 48 h
 * after the rejection to send a new receipt (decision 5). The booking keeps
 * holding its units meanwhile.
 */
export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse
): Promise<void> {
	if (req.method === 'PUT') {
		let tokenData = req.headers.authorization;
		let token = tokenData?.split(' ')[1];

		if (!token || jwt.verify(token, JWT_SECRET) === null) {
			res.status(401).json({ success: false, message: 'Invalid token' });
			return;
		}

		let userInfo = jwt.decode(token) as JWTPayload;
		if (userInfo.userType !== 'admin') {
			res.status(403).json({ success: false, message: 'Access denied' });
			return;
		}

		const { bookingId, remarks } = req.body;

		const transaction = await sequelize.transaction();

		try {
			// Locked: a confirmation or the expiry job may act on it at the same moment.
			const booking = await ProjectInvestmentBooking.findOne({
				where: {
					bookingId,
				},
				transaction,
				lock: transaction.LOCK.UPDATE,
			});

			if (!booking) {
				await transaction.rollback();
				return res.status(404).json({
					success: false,
					message: 'Booking not found',
				});
			}
			if (booking.cancelled === 'yes') {
				await transaction.rollback();
				return res.status(409).json({ success: false, code: 'BOOKING_CANCELLED', message: 'This booking is cancelled.' });
			}
			if (!isProofSubmitted(booking.paymentConfirmationStatus)) {
				await transaction.rollback();
				return res.status(409).json({
					success: false,
					code: 'NO_RECEIPT_TO_REVIEW',
					message: booking.paymentConfirmationStatus === 'confirmed'
						? 'This booking is already confirmed, so its receipt cannot be denied.'
						: 'There is no receipt waiting for review on this booking.',
				});
			}

			// A reinvestment carries an investor's matured money: rejecting its
			// top-up receipt must not kill it. It goes back to waiting for a
			// receipt (the app then offers the upload again); cancel it instead to
			// return the money to the matured investment.
			const reinvestment = (booking as any).bookingType === 'reinvestment';
			const now = new Date();
			const due = dueAfterRejection(booking.paymentDueAt as any, now, newBookingDueDate(new Date(booking.createdAt)));
			booking.paymentConfirmationStatus = reinvestment ? 'pending' : 'denied';
			booking.paymentDueAt = due;
			// Reminders start again for the new deadline; any already due are not resent.
			booking.paymentRemindersSent = remindersDue(due, now);
			await booking.save({ transaction });

			await BookingStatusEntry(
				'denied',
				booking.idProjectInvestmentBookings!,
				userInfo.idUsers,
				`${remarks || 'Receipt rejected'}${reinvestment ? ' (reinvestment: waiting for a new receipt)' : ''}. New receipt due by ${formatDue(due)} (Dhaka).`.slice(0, 500),
				transaction,
			);

			await transaction.commit();

			return res.status(200).json({
				success: true,
				data: booking,
				message: 'Booking status updated successfully',
			});
		} catch (err) {
			await transaction.rollback().catch(() => undefined);
			return res.status(400).json({ success: false, message: (err as Error).message });
		}
	} else {
		res.status(405).json({ success: false, message: 'Method not allowed' });
	}
}
