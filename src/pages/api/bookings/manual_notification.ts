import { NextApiRequest, NextApiResponse } from 'next';
import { ProjectInvestmentBooking, ProjectInvestor, ProjectPartnerInvestor, ProjectSpecialBookingReq, User, Project } from '@/models/__associations';
import { db } from '@/config/db';
import Joi from 'joi';
import Cors from 'micro-cors';
import { JWT_SECRET } from '@/config/constants';
import jwt from 'jsonwebtoken';
import JWTPayload from '@/types/JWTPayload';
import { generateNotification } from '@/notifications';
import BookingStatusEntry from '@/utils/BookingStatusEntry';
import knex from 'knex';
import { formatMaturityDate } from '@/utils/CalulcateMaturityDate';

const cors = Cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS', 'PUT'],
    allowHeaders: ['X-Requested-With', 'Authorization', 'Content-Type'],
});

async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'OPTIONS') { return res.status(200).end(); }
    if (req.method === 'POST') {

        let tokenData = req.headers.authorization;
        let token = tokenData?.split(' ')[1];

        if (!token) { res.status(401).json({ success: false, message: 'Token not found' }); return; }
        try { jwt.verify(token, JWT_SECRET); } catch (error: any) { return res.status(401).json({ success: false, message: error.message }); }

        let userInfo = jwt.decode(token) as JWTPayload;
        if (userInfo.userType !== 'admin') { res.status(403).json({ success: false, message: 'Access denied' }); return; }
    }

    try {
        const { notificationType, idProjectInvestors } = req.body;

        const projectInvestorData = await ProjectInvestor.findOne({
            where: {
                idProjectInvestors: idProjectInvestors
            },
            include: [
                { model: User },
                { model: Project },
            ]
        });

        const investorUser = await User.findOne({
            where: {
                idUsers: projectInvestorData?.User.idUsers
            }
        });

        if (notificationType === '2') {
            await generateNotification('project_maturity_2_weeks', {
                fullName: projectInvestorData?.User.fullName || 'Unknown Investor',
                projectName: projectInvestorData?.Project.projectName || 'Unknown Project',
            },
                investorUser!
            )
        }

        if (notificationType === '1') {

            const projectPartnerInvestor = await ProjectPartnerInvestor.findAll({
                where: {
                    idProjectInvestors: projectInvestorData?.idProjectInvestors
                },
            });

            const maturityDate = formatMaturityDate( projectInvestorData?.investmentDate!, projectInvestorData?.Project.duration || 0, projectInvestorData?.Project.tenure as 'months' | 'years')

            const totalInvestment = projectPartnerInvestor.reduce((acc, partner) => acc + partner.amountInvested, 0);

            const suggestedProjects = await db('projects')
                .select('projectName', 'unit_investment_value', 'return_range_min', 'return_range_max', 'duration', 'tenure')
                .where('project_status', 'created')
                .andWhere('unit_investment_value', '<', totalInvestment)

            await generateNotification('project_maturity_1_week', {
                fullName: projectInvestorData?.User.fullName || 'Unknown Investor',
                projectName: projectInvestorData?.Project.projectName || 'Unknown Project',
                maturityDate: maturityDate.maturityDateFormatted,
                suggestedProjects
            },
                investorUser!
            )
        }

    } catch (error) {
        console.error('Error processing manual notification:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }

    return res.status(200).json({ success: true, message: 'Notification processed successfully' });
}

export default cors(handler as any);

