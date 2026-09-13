import { NextApiRequest, NextApiResponse } from 'next'
import { Unit } from '@/models/__associations'

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
): Promise<void> {
    if (req.method === 'GET') {
        try {
            const result = await Unit.findAll({
                attributes: ['idUnit', 'unitName', 'unitCode'],
            });

            return res.status(200).json({ success: true, data: result });
        } catch (error) {
            return res.status(400).json({ success: false, message: (error as Error).message });
        }
    } else {
        res.status(405).json({ success: false, message: 'Method not allowed' });
    }
}
