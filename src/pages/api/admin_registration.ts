import { NextApiRequest, NextApiResponse } from 'next';
import { User } from '@/models/__associations';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'POST') {
        const { name, email, phoneNumber } = req.body

        try {
            const admin = await User.create({
                fullName: name,
                email,
                phoneNumber,
                userType: 'admin'
            })

            return res.status(200).json({ admin })
        } catch (err: any) {
            console.error(err)
            return res.status(500).json({ message: err.message })
        }
    } else {
        res.status(405).json({ message: 'Method not allowed' })
    }
}