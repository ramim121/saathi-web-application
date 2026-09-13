import { NextApiRequest, NextApiResponse } from 'next';
import { User, ManualNotification } from '@/models/__associations';
import { Op, fn, col } from 'sequelize'
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '@/config/constants';
import JWTPayload from '@/types/JWTPayload';
export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    if (req.method === 'GET') {
        let tokenData = req.headers.authorization;
        let token = tokenData?.split(' ')[1];

        if (!token || jwt.verify(token, JWT_SECRET) === null) { res.status(401).json({ success: false, message: 'Invalid token' }); return; }

        let userInfo = jwt.decode(token) as JWTPayload;
        if (userInfo.userType !== 'admin') { res.status(403).json({ success: false, message: 'Access denied' }); return; }

        try {

            const result = await ManualNotification.findOne({
                where: {
                    idManualNotifications: req.query.id
                },
                include: [
                    { model: User, attributes: ['fullName'] }
                ],
                attributes: [
                    'idManualNotifications',
                    'emailBody',
                    'emailSubject',
                    'pushNotificationBody',
                    'pushNotificationImage',
                    'pushNotificationTitle',
                    'sendOn',
                    'sendViaEmail',
                    'sendViaPush',
                    'sendViaSms',
                    'smsBody',
                    [fn('DATE_FORMAT', col('send_on'), '%Y-%m-%d %H:%i:%s'), 'formattedSendOn'],
                ]
            });

            return res.status(200).json({ success: true, data: result });
        } catch (error) {
            return res.status(400).json({ success: false, message: (error as Error).message })
        }
    } else {
        res.status(405).json({ success: false, message: 'Method not allowed' })
    }
}