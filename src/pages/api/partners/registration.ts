import { NextApiRequest, NextApiResponse } from 'next';
import { User } from '@/models/__associations';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'POST') {
        const { name, phoneNumber, age, location, role, painPoints, motivation, interestedIn, joiningDate, skills } = req.body

        try {
            const partner = await User.create({
                fullName: name,
                phoneNumber,
                age,
                location,
                role,
                painPoints,
                motivation,
                interestedIn,
                joiningDate,
                skills,
                userType: 'partner'
            })

            return res.status(200).json({ partner })
        } catch (err: any) {
            console.error(err)
            return res.status(500).json({ message: err.message })
        }
    } else {
        res.status(405).json({ message: 'Method not allowed' })
    }
}