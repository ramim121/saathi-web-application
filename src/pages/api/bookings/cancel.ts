import { NextApiRequest, NextApiResponse } from 'next';
import { ProjectInvestmentBooking, ProjectInvestor } from '@/models/__associations';
import sequelize from '@/config/db';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '@/config/constants';
import JWTPayload from '@/types/JWTPayload';
import BookingStatusEntry from '@/utils/BookingStatusEntry';
import ProjectInvestorStatusEntry from '@/utils/ProjectInvestorStatusEntry';
import { undoReinvestment } from '@/utils/reinvestmentServer';
import Cors from 'micro-cors';


const cors = Cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS', 'PUT'],
    allowHeaders: ['X-Requested-With', 'Authorization', 'Content-Type'],
});

/** Lines a cancellation may close: money not yet in, or in and still running. */
const CANCELLABLE_LINES = ['booked', 'confirmed', 'cancelled'];

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
            // Read and locked INSIDE the transaction. It was read outside it,
            // with no lock, so a cancel and a confirmation at the same moment
            // could leave a booking both paid and cancelled; the expiry job
            // now cancels bookings too.
            const booking = await ProjectInvestmentBooking.findByPk(idProjectInvestmentBookings, { transaction, lock: transaction.LOCK.UPDATE });
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
            const admin = userInfo.userType === 'admin';
            if (!admin && Number(booking.idUsers) !== Number(userInfo.idUsers)) {
                await transaction.rollback();
                return res.status(404).json({ success: false, message: 'Booking not found' });
            }

            // Cancelling a booking that is already paid for is not a user
            // action — it needs a refund decision — so only an admin may do it.
            if (!admin && booking.paymentConfirmationStatus === 'confirmed') {
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

            const projectInvestor = await ProjectInvestor.findAll({
                where: { idProjectInvestmentBookings: booking.idProjectInvestmentBookings! },
                transaction,
            });

            // A line that has matured, been paid out or rolled over is history:
            // cancelling the booking used to overwrite it with `cancelled`.
            const finished = projectInvestor.filter((line) => !CANCELLABLE_LINES.includes(String(line.investmentStatus)));
            if (finished.length) {
                await transaction.rollback();
                return res.status(409).json({
                    success: false,
                    code: 'LINES_FINISHED',
                    message: 'This booking has an investment that has matured, been paid out or rolled over, so the booking cannot be cancelled.',
                });
            }

            booking.cancelled = 'yes';
            booking.cancelReason = booking.bookingType === 'reinvestment' ? 'reinvestment_undone' : admin ? 'admin' : 'investor';
            booking.cancelledAt = new Date();
            booking.cancelledBy = userInfo.idUsers;
            await booking.save({ transaction });

            for (const investor of projectInvestor) {
                if (investor.investmentStatus === 'cancelled') continue;
                investor.investmentStatus = 'cancelled';
                await investor.save({ transaction });
                await ProjectInvestorStatusEntry('cancelled', investor.idProjectInvestors as number, userInfo.idUsers, String(remarks).slice(0, 500), transaction);
            }

            // A reinvestment's money came from a matured investment: give it back
            // to that investment (and reverse its balance entries) rather than
            // leaving it closed as "reinvested" into a booking that no longer exists.
            await undoReinvestment(booking as any, userInfo.idUsers, transaction);

            await BookingStatusEntry('cancelled', booking.idProjectInvestmentBookings!, userInfo.idUsers, String(remarks).slice(0, 500), transaction);

            await transaction.commit();
            return res.status(200).json({ success: true, message: 'Booking cancelled successfully', data: booking });
        } catch (error) {
            await transaction.rollback().catch(() => undefined);
            return res.status(400).json({ success: false, message: (error as Error).message });
        }
    } else {
        res.status(405).json({ success: false, message: 'Method not allowed' });
    }
}

export default cors(handler as any);
