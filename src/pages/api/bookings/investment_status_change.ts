import { NextApiRequest, NextApiResponse } from 'next';
import { ProjectInvestmentBooking, ProjectInvestor, User } from '@/models/__associations';
import sequelize from '@/config/db';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '@/config/constants';
import JWTPayload from '@/types/JWTPayload';
import { generateNotification } from '@/notifications';
import ProjectInvestorStatusEntry from '@/utils/ProjectInvestorStatusEntry';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'PUT') {
        let tokenData = req.headers.authorization;
        let token = tokenData?.split(' ')[1];

        if (!token || jwt.verify(token, JWT_SECRET) === null) { res.status(401).json({ success: false, message: 'Invalid token' }); return; }

        let userInfo = jwt.decode(token) as JWTPayload;
        if (userInfo.userType !== 'admin') { res.status(403).json({ success: false, message: 'Access denied' }); return; }

        const { idProjectInvestors, investmentStatus, actualProfitAmount, actualProfitPercentage } = req.body

        const transaction = await sequelize.transaction();
        try {

            const investor = await ProjectInvestor.findByPk(idProjectInvestors, {
                include: [ProjectInvestmentBooking]
            });
            const investorUser = await User.findByPk(investor?.idUsers);
            if (!investor) {
                return res.status(404).json({ success: false, message: 'Project investor not found' });
            }
            investor.investmentStatus = investmentStatus;
            investor.actualProfitAmount = actualProfitAmount;
            investor.actualProfitPercentage = actualProfitPercentage;
            await investor.save({ transaction });

            if (investmentStatus === 'cancelled') {
                await generateNotification('booking_cancelled', {
                    fullName: investorUser?.fullName,
                    bookingId: investor.ProjectInvestmentBooking.bookingId,
                }, investorUser!);
            }

            const investorBookingStatus = await ProjectInvestorStatusEntry('ready_for_withdrawal', idProjectInvestors, userInfo.idUsers, '', transaction);
            if (!investorBookingStatus) {
                await transaction.rollback();
                throw new Error('Error updating investor booking status');
            }

            await transaction.commit();

            return res.status(200).json({ success: true, message: 'Investment status changed successfully', data: investor })
        } catch (error) {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: (error as Error).message })
        }
    } else {
        res.status(405).json({ success: false, message: 'Method not allowed' })
    }
}