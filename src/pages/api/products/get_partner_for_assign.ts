import { NextApiRequest, NextApiResponse } from 'next'
import { User } from '@/models/__associations'
import { Op } from 'sequelize'
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '@/config/constants';
import JWTPayload from '@/types/JWTPayload';

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
): Promise<void> {
    if (req.method === 'GET') {
        let tokenData = req.headers.authorization;
        let token = tokenData?.split(' ')[1];

        if (!token || jwt.verify(token, JWT_SECRET) === null) { res.status(401).json({ success: false, message: 'Invalid token' }); return; }

        let userInfo = jwt.decode(token) as JWTPayload;
        if (userInfo.userType !== 'admin') { res.status(403).json({ success: false, message: 'Access denied' }); return; }

        try {
            const result = await User.findAll({
                where: {
                    userType: 'partner',
                    partnerType: { [Op.in]: ['product', 'both'] },
                    status: 'active',
                    // idUsers: {
                    //     [Op.notIn]: Sequelize.literal(`(
                    //     SELECT id_users
                    //     FROM product_partners
                    //     WHERE id_products = ${idProducts}
                    //   )`)
                    // }
                }
            });

            return res.status(200).json({ success: true, data: result })
        } catch (error) {
            return res.status(400).json({ success: false, message: (error as Error).message })

        }
    } else {
        res.status(405).json({ success: false, message: 'Method not allowed' })
    }
}
