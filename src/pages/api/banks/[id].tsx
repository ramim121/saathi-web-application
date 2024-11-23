import { NextApiRequest, NextApiResponse } from 'next';
import { Bank, BankBranch } from '@/models/__associations';

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    if (req.method === 'GET') {
        try {
            const bankData = await Bank.findByPk(req.query.id as string, {
                include: BankBranch
            });

            if (!bankData) {
                return res.status(404).json({ success: false, message: 'Bank not found' })
            }

            return res.status(200).json({ success: true, data: bankData });
        } catch (error) {
            return res.status(500).json({ success: false, message: (error as Error).message })
        }
    } else {
        res.status(405).json({ success: false, message: 'Method not allowed' })
    }
}