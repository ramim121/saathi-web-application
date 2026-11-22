import { NextApiRequest, NextApiResponse } from 'next';
import AppFcmToken from '@/models/AppFcmToken';
import jwt from 'jsonwebtoken';
import JWTPayload from '@/types/JWTPayload';
import { JWT_SECRET } from '@/config/constants';
import Cors from 'micro-cors';

const cors = Cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE'],
    allowHeaders: ['X-Requested-With', 'Authorization', 'Content-Type'],
});

function readToken(req: NextApiRequest): JWTPayload | null {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return null;
    try {
        jwt.verify(token, JWT_SECRET);
        return jwt.decode(token) as JWTPayload;
    } catch {
        // An expired token used to throw out of the handler as a 500, which the
        // app treats as a forced logout.
        return null;
    }
}

function readFcmToken(req: NextApiRequest): string {
    const raw = req.body?.fcmToken;
    return typeof raw === 'string' ? raw.trim() : '';
}

/**
 * POST   /api/fcm  { fcmToken }  links this device's push token to the signed-in user.
 * DELETE /api/fcm  { fcmToken }  unlinks it, for sign-out.
 *
 * Without DELETE, signing out left the token on the old account, so a shared
 * phone kept receiving the previous investor's booking and payout
 * notifications until somebody else signed in on it.
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'OPTIONS') { return res.status(200).end(); }

    if (req.method !== 'POST' && req.method !== 'DELETE') {
        return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

    const userInfo = readToken(req);
    if (!userInfo) { return res.status(401).json({ success: false, message: 'Invalid token' }); }

    const fcmToken = readFcmToken(req);
    if (!fcmToken) {
        return res.status(400).json({ success: false, message: 'FCM token is required' });
    }

    if (req.method === 'POST') {
        const existingFcmToken = await AppFcmToken.findOne({ where: { fcmToken } });
        if (existingFcmToken) {
            existingFcmToken.idUsers = userInfo.idUsers;
            await existingFcmToken.save();
        } else {
            await AppFcmToken.create({ fcmToken, idUsers: userInfo.idUsers });
        }
        return res.status(200).json({ success: true });
    }

    // DELETE: only the caller's own link to this token is removed.
    const removed = await AppFcmToken.destroy({ where: { fcmToken, idUsers: userInfo.idUsers } });
    return res.status(200).json({ success: true, removed });
}

export default cors(handler as any);
