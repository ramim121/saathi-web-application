import { NextApiRequest, NextApiResponse } from 'next';
import { User } from '@/models/__associations';
import { Op, Sequelize } from 'sequelize';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '@/config/constants';
import JWTPayload from '@/types/JWTPayload';

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
): Promise<void> {
    if (req.method !== 'GET') {
        res.status(405).json({ success: false, message: 'Method not allowed' });
        return;
    }

    const tokenData = req.headers.authorization;
    const token = tokenData?.split(' ')[1];

    if (!token || jwt.verify(token, JWT_SECRET) === null) {
        res.status(401).json({ success: false, message: 'Invalid token' });
        return;
    }

    const userInfo = jwt.decode(token) as JWTPayload;
    if (userInfo.userType !== 'admin') {
        res.status(403).json({ success: false, message: 'Access denied' });
        return;
    }

    try {
        const projectId = Number(req.query.id);
        if (!projectId) {
            res.status(400).json({ success: false, message: 'Project is required' });
            return;
        }

        const result = await User.findAll({
            attributes: ['idUsers', 'fullName', 'phoneNumber', 'location', 'joiningDate'],
            where: {
                userType: 'partner',
                partnerType: {
                    [Op.or]: ['project', 'both']
                },
                idUsers: {
                    [Op.notIn]: Sequelize.literal(`(
                        SELECT id_users
                        FROM project_partners
                        WHERE id_projects = ${projectId}
                    )`)
                }
            }
        });

        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(400).json({ success: false, message: (error as Error).message });
    }
}
