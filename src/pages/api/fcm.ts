import { NextApiRequest, NextApiResponse } from 'next';
import AppFcmToken from '@/models/AppFcmToken';
import jwt from 'jsonwebtoken';
import JWTPayload from '@/types/JWTPayload';
import { JWT_SECRET } from '@/config/constants';
import Cors from 'micro-cors';

const cors = Cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS','PUT'],
    allowHeaders: ['X-Requested-With', 'Authorization', 'Content-Type'],
});

async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'OPTIONS') { return res.status(200).end(); }
    if (req.method === 'POST') {
        let tokenData = req.headers.authorization;
        let token = tokenData?.split(' ')[1];

        if (!token || jwt.verify(token, JWT_SECRET) === null) { res.status(401).json({ success: false, message: 'Invalid token' }); return; }

        let userInfo = jwt.decode(token) as JWTPayload;
        let { fcmToken }: { fcmToken: string } = req.body;
        // FCM token validation
        fcmToken = fcmToken.trim();
        if (!fcmToken) {
            return res.status(400).json({ success: false, message: 'FCM token are required' });
        }
        let fcmTokenData = await AppFcmToken.create({ fcmToken, idUsers: userInfo!.idUsers });
        return res.status(200).json({ success: true, fcmTokenData });
    }
    else {
        res.status(405).json({ success: false, message: 'Method not allowed' });
    }
}

export default cors(handler as any);