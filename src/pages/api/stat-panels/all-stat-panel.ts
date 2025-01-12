import { NextApiRequest, NextApiResponse } from 'next';
import { AppStatPanel } from '@/models/__associations';
import { Op } from 'sequelize';
import Cors from 'micro-cors';
const cors = Cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS', 'PUT'],
    allowHeaders: ['X-Requested-With', 'Authorization', 'Content-Type'],
});
async function handler(req: NextApiRequest, res: NextApiResponse) {
    console.log(req.headers);
    if (req.method === 'OPTIONS') { return res.status(200).end(); }
    if (req.method === 'GET') {
        try {
            const { q } = req.query;

            const queryOptions: any = q ? {
                where: {
                    statType: {
                        [Op.like]: `%${q}%`
                    }
                }
            } : {};

            const result = await AppStatPanel.findAll(queryOptions);

            return res.status(200).json({ success: true, data: result });
        } catch (error) {
            return res.status(500).json({ success: false, message: (error as Error).message })
        }
    } else {
        res.status(405).json({ success: false, message: 'Method not allowed' })
    }
}

export default cors(handler as any);