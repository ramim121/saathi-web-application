import { NextApiRequest, NextApiResponse } from 'next';
import AppFcmToken from '@/models/AppFcmToken';
import jwt from 'jsonwebtoken';
import JWTPayload from '@/types/JWTPayload';
import { JWT_SECRET } from '@/config/constants';
import Cors from 'micro-cors';
import NotificationQueue from '@/models/NotificationQueue';
import { Op } from 'sequelize';

const cors = Cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS', 'PUT'],
    allowHeaders: ['X-Requested-With', 'Authorization', 'Content-Type'],
});

async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'OPTIONS') { return res.status(200).end(); }
    if (req.method === 'GET') {
        let tokenData = req.headers.authorization;
        let token = tokenData?.split(' ')[1];

        if (!token || jwt.verify(token, JWT_SECRET) === null) { res.status(401).json({ success: false, message: 'Invalid token' }); return; }

        let userInfo = jwt.decode(token) as JWTPayload;
        console.log(userInfo);
        const offset = parseInt(req.query.offset as string) || 0;
        const limit = parseInt(req.query.limit as string) || 25;

        const notificationData = await NotificationQueue.findAll({
            attributes: { exclude: ['response'] },
            where: {
                [Op.or]:[{ receiver: userInfo.idUsers }, { receiver: null }],
                notificationType: 'push',
            },
            offset,
            limit,
            order: [['createdAt', 'DESC']],
            group: ['createdAt']
        });

        return res.status(200).json({ success: true, data: notificationData });
    }
}

export default cors(handler as any);