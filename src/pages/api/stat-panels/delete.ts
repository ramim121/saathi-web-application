import { NextApiRequest, NextApiResponse } from 'next';
import { AppStatPanel } from '@/models/__associations';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '@/config/constants';
import JWTPayload from '@/types/JWTPayload';
import Cors from 'micro-cors';

const cors = Cors({
    origin: '*',
    allowMethods: ['DELETE', 'OPTIONS'],
    allowHeaders: ['X-Requested-With', 'Authorization', 'Content-Type'],
});

async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'OPTIONS') { return res.status(200).end(); }

    if (req.method === 'DELETE') {
        const tokenData = req.headers.authorization;
        const token = tokenData?.split(' ')[1];

        if (!token || jwt.verify(token, JWT_SECRET) === null) { res.status(401).json({ success: false, message: 'Invalid token' }); return; }

        const userInfo = jwt.decode(token) as JWTPayload;
        if (userInfo.userType !== 'admin') { res.status(403).json({ success: false, message: 'Access denied' }); return; }

        const { idAppStatPanel } = req.query;

        if (!idAppStatPanel) {
            return res.status(400).json({ success: false, message: 'idAppStatPanel is required' });
        }

        try {
            const deleted = await AppStatPanel.destroy({
                where: { idAppStatPanel: idAppStatPanel as any }
            });

            if (!deleted) {
                return res.status(404).json({ success: false, message: 'Stat Panel not found' });
            }

            return res.status(200).json({ success: true, message: 'Stat deleted successfully' });
        } catch (error) {
            return res.status(400).json({ success: false, message: (error as Error).message });
        }
    } else {
        res.status(405).json({ success: false, message: 'Method not allowed' });
    }
}

export default cors(handler as any);

