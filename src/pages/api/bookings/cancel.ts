import { NextApiRequest, NextApiResponse } from 'next';
import { ProjectInvestmentBooking, ProjectInvestor } from '@/models/__associations';
import sequelize from '@/config/db';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '@/config/constants';
import JWTPayload from '@/types/JWTPayload';
import BookingStatusEntry from '@/utils/BookingStatusEntry';
import Cors from 'micro-cors';


const cors = Cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS', 'PUT'],
    allowHeaders: ['X-Requested-With', 'Authorization', 'Content-Type'],
});

async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'OPTIONS') { return res.status(200).end(); }
    if (req.method === 'PUT') {
        let tokenData = req.headers.authorization;
        let token = tokenData?.split(' ')[1];

        if (!token || jwt.verify(token, JWT_SECRET) === null) {
            res.status(401).json({ success: false, message: 'Invalid token' });
            return;
        }

        let userInfo = jwt.decode(token) as JWTPayload;

        let { idProjectInvestmentBookings, remarks } = req.body;
        if (!remarks) {
            remarks = 'Booking cancelled by user';
        }
        const transaction = await sequelize.transaction();
        try {
            const booking = await ProjectInvestmentBooking.findByPk(idProjectInvestmentBookings);
            if (!booking) {
                await transaction.rollback();
                return res.status(404).json({ success: false, message: 'Booking not found' });
            }

            /**
             * SECURITY: ownership check.
             *
             * The booking id comes from the request body and nothing tied it to
             * the caller — the access check above this was commented out — so
             * any signed-in user could cancel **anyone's** booking by guessing a
             * sequential id, releasing their units.
             *
             * Admins may cancel any booking; that is what the admin panel does.
             * A 404 rather than a 403 for everyone else, so this does not become
             * a way to discover which ids exist.
             */
            if (userInfo.userType !== 'admin' && Number(booking.idUsers) !== Number(userInfo.idUsers)) {
                await transaction.rollback();
                return res.status(404).json({ success: false, message: 'Booking not found' });
            }

            // Cancelling a booking that is already paid for is not a user
            // action — it needs a refund decision — so only an admin may do it.
            if (userInfo.userType !== 'admin' && booking.paymentConfirmationStatus === 'confirmed') {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    message: 'This booking is already confirmed. Contact support to cancel it.',
                });
            }

            if (booking.cancelled === 'yes') {
                await transaction.rollback();
                return res.status(400).json({ success: false, message: 'This booking is already cancelled' });
            }

            booking.cancelled = 'yes';
            await booking.save({ transaction });

            const projectInvestor = await ProjectInvestor.findAll({
                where: { idProjectInvestmentBookings: booking.idProjectInvestmentBookings! },
                transaction,
            });

            for (const investor of projectInvestor) {
                investor.investmentStatus = 'cancelled';
                await investor.save({ transaction });
            }

            if (booking.idProjectInvestmentBookings === undefined) {
                await transaction.rollback();
                return res.status(400).json({ success: false, message: 'Booking ID is undefined' });
            }
            const bookingStatus = await BookingStatusEntry('cancelled', booking.idProjectInvestmentBookings, userInfo.idUsers, remarks, transaction);
            if (!bookingStatus) {
                await transaction.rollback();
                return res.status(400).json({ success: false, message: 'Error cancelling booking' });
            }

            await transaction.commit();
            return res.status(200).json({ success: true, message: 'Booking cancelled successfully', data: booking });
        } catch (error) {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: (error as Error).message });
        }
    } else {
        res.status(405).json({ success: false, message: 'Method not allowed' });
    }
}

export default cors(handler as any);