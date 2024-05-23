import { NextApiRequest, NextApiResponse } from 'next';
import { InvestmentSetup } from '@/models/__associations';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'POST') {
        const { nameOfThePlan, type, minimumReturn, maximumReturn, duration, tenure } = req.body

        try {
            const investment = await InvestmentSetup.create({
                planName: nameOfThePlan,
                type,
                minimumReturn,
                maximumReturn,
                duration,
                tenure
            })

            return res.status(200).json({ investment })
        } catch (err: any) {
            console.error(err)
            return res.status(500).json({ message: err.message })
        }
    } else {
        res.status(405).json({ message: 'Method not allowed' })
    }
}