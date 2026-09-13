import { NextApiRequest, NextApiResponse } from 'next';
import { ProjectInvestmentBooking } from '@/models/__associations';
import sequelize from '@/config/db';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '@/config/constants';
import JWTPayload from '@/types/JWTPayload';
import BookingStatusEntry from '@/utils/BookingStatusEntry';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'PUT') {
        let tokenData = req.headers.authorization;
        let token = tokenData?.split(' ')[1];

        if (!token || jwt.verify(token, JWT_SECRET) === null) { res.status(401).json({ success: false, message: 'Invalid token' }); return; }

        let userInfo = jwt.decode(token) as JWTPayload;
        if (userInfo.userType !== 'admin') { res.status(403).json({ success: false, message: 'Access denied' }); return; }

        const { idProjectInvestmentBookings, status } = req.body

        const transaction = await sequelize.transaction();
        try {

            const booking = await ProjectInvestmentBooking.findByPk(idProjectInvestmentBookings);
            if (!booking) {
                return res.status(404).json({ success: false, message: 'Booking not found' });
            }
            booking.collectionStatus = status;
            await booking.save({ transaction });

            const bookingStatus = await BookingStatusEntry(`collection_${status}`, idProjectInvestmentBookings!, userInfo.idUsers, '', transaction);
            if (!bookingStatus) {
                await transaction.rollback();
                throw new Error('Error in booking placed');
            }

            await transaction.commit();
            return res.status(200).json({ success: true, message: 'Collection status changed successfully', data: booking })
        } catch (error) {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: (error as Error).message })
        }
    } else {
        res.status(405).json({ success: false, message: 'Method not allowed' })
    }
}