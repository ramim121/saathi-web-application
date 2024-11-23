import { NextApiRequest, NextApiResponse } from 'next';
import { Bank, UserBank, BankBranch } from '@/models/__associations';

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    if (req.method === 'GET') {
        try {

            const result = await UserBank.findOne({
                where: { idUsers: req.query.id },
                include: [
                    {
                        model: Bank,
                        required: true,
                    },
                    {
                        model: BankBranch,
                        required: true,
                    }
                ],
                order: [['idUserBanks', 'DESC']]
            });
            return res.status(200).json({ success: true, data: result });
        } catch (error) {
            return res.status(500).json({ success: false, message: (error as Error).message })
        }
    } else {
        res.status(405).json({ success: false, message: 'Method not allowed' })
    }
}