import { NextApiRequest, NextApiResponse } from 'next';
import { User, File } from '@/models/__associations'

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    if (req.method === 'GET') {
        try {

            const result = await User.findAll({
                attributes: [
                    'idUsers',
                    'fullName',
                    'phoneNumber',
                    'age',
                    'location',
                    'role',
                    'bio',
                    'interestedIn',
                    'skills',
                    'joiningDate',
                    'education',
                ],
                include: [
                    { model: File, as: 'ProfilePicture' },
                ],
                limit: 5,
                where: {
                    user_type: 'partner',
                },
            });

            res.status(200).json(result);
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Server error' });
        }
    } else {
        res.status(405).json({ error: 'Method not allowed' });
    }
}