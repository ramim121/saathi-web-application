import { NextApiRequest, NextApiResponse } from 'next'
import { ProjectInvestor, Project, ProjectPartnerInvestor, User, ProjectPartner, ProjectInvestmentBooking } from '@/models/__associations'
import Cors from 'micro-cors';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '@/config/constants';
import JWTPayload from '@/types/JWTPayload';
const cors = Cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS', 'PUT'],
    allowHeaders: ['X-Requested-With', 'Authorization', 'Content-Type'],
});

async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ success: false, message: 'Method not allowed' });

    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'Token missing' });

    let userInfo: JWTPayload;
    try {
        userInfo = jwt.verify(token, JWT_SECRET) as JWTPayload;
    } catch {
        return res.status(401).json({ success: false, message: 'Invalid token' });
    }

    if (userInfo.userType !== 'admin') return res.status(403).json({ success: false, message: 'Access denied' });

    const { orderBy, orderType, page, pageSize } = req.query;

    const whereClause: any = {
        investmentStatus: 'confirmed'
    };

    const limit = parseInt(pageSize as string) || 10;
    const offset = (parseInt(page as string) - 1) * limit || 0;

    try {
        const result = await ProjectInvestor.findAndCountAll({
            include: [
                {
                    model: Project,
                },
                {
                    model: ProjectPartnerInvestor,
                    include: [
                        {
                            model: ProjectPartner,
                            include: [
                                {
                                    model: User,
                                },
                            ],
                        },
                    ],
                },
                {
                    model: ProjectInvestmentBooking,
                    include: [
                        {
                            model: User,
                        },
                    ],
                },
            ],
            where: whereClause,
            distinct: true,
            limit,
            offset,
            order: [[orderBy as string || 'createdAt', orderType === 'DESC' ? 'DESC' : 'ASC']],
        });

        res.status(200).json({
            success: true,
            data: result.rows,
            total: result.count,
            currentPage: page ? parseInt(page as string) : 1,
            totalPages: Math.ceil(result.count / limit),
        });
    } catch (error) {
        res.status(400).json({ success: false, message: (error as Error).message });
    }
}

export default cors(handler as any);
