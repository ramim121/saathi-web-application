import { NextApiRequest, NextApiResponse } from 'next';
import { Project, File } from '@/models/__associations';

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    if (req.method === 'GET') {
        try {

            const result = await Project.findAll(
                {
                    include: [
                        {
                            model: File, as: 'MainImage', required: false
                        }
                    ],
                    limit: 5,
                    order: [['createdAt', 'DESC']]
                }
            )

            res.status(200).json({ success: true, data: result });
        } catch (error) {
            return res.status(500).json({ success: false, message: (error as Error).message })
        }
    } else {
        res.status(405).json({ success: false, message: 'Method not allowed' })
    }
}