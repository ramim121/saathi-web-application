import { NextApiRequest, NextApiResponse } from 'next';
import { ProjectInvestmentBooking } from '@/models/__associations';
import sequelize from '@/config/db';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '@/config/constants';
import JWTPayload from '@/types/JWTPayload';
import BookingStatusEntry from '@/utils/BookingStatusEntry';
import { newBookingDueDate } from '@/utils/bookingHolds';
import { dueAfterFailedCollection, formatDue, isUnderReview, remindersDue } from '@/utils/bookingHoldsShared';

const STATUSES = ['pending', 'collected', 'failed'];

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'PUT') {
        let tokenData = req.headers.authorization;
        let token = tokenData?.split(' ')[1];

        if (!token || jwt.verify(token, JWT_SECRET) === null) { res.status(401).json({ success: false, message: 'Invalid token' }); return; }

        let userInfo = jwt.decode(token) as JWTPayload;
        if (userInfo.userType !== 'admin') { res.status(403).json({ success: false, message: 'Access denied' }); return; }

        const { idProjectInvestmentBookings, status } = req.body
        if (!STATUSES.includes(String(status))) {
            return res.status(400).json({ success: false, message: 'Unknown collection status' });
        }

        const transaction = await sequelize.transaction();
        try {
            // Locked: the expiry job and a confirmation may touch the same booking.
            const booking = await ProjectInvestmentBooking.findByPk(idProjectInvestmentBookings, { transaction, lock: transaction.LOCK.UPDATE });
            if (!booking) {
                await transaction.rollback();
                return res.status(404).json({ success: false, message: 'Booking not found' });
            }
            booking.collectionStatus = status;

            /*
             * A failed cash/cheque collection on a booking still waiting for
             * review returns it to awaiting payment, with at least 48 h to pay.
             * It used to stay "proof submitted", which now holds units with no
             * deadline. A booking already confirmed is left as it is: that is a
             * refund decision, not a status change.
             */
            let remark = '';
            const now = new Date();
            if (status === 'failed' && booking.cancelled === 'no' && isUnderReview(booking.paymentConfirmationStatus)) {
                const due = dueAfterFailedCollection(booking.paymentDueAt as any, now, newBookingDueDate(new Date(booking.createdAt)));
                booking.paymentConfirmationStatus = 'pending';
                booking.paymentDueAt = due;
                booking.paymentRemindersSent = remindersDue(due, now);
                remark = `Collection failed: back to awaiting payment, due ${formatDue(due)} (Dhaka)`;
            }
            await booking.save({ transaction });

            await BookingStatusEntry(`collection_${status}`, idProjectInvestmentBookings!, userInfo.idUsers, remark, transaction);

            await transaction.commit();
            return res.status(200).json({ success: true, message: 'Collection status changed successfully', data: booking })
        } catch (error) {
            await transaction.rollback().catch(() => undefined);
            return res.status(400).json({ success: false, message: (error as Error).message })
        }
    } else {
        res.status(405).json({ success: false, message: 'Method not allowed' })
    }
}
