import { NextApiRequest, NextApiResponse } from 'next';
import { User, File, ProjectPartner } from '@/models/__associations';

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    if (req.method === 'GET') {
        try {
            const projectId = req.query.projectId as string;
            const limit = req.query.limit as string;

            const result = await ProjectPartner.findAll({
                where: {
                    idProjects: projectId
                },
                limit: parseInt(limit),
                include: [
                    {
                        model: User,
                        include: [
                            { model: File, as: 'ProfilePicture' }
                        ]
                    }
                ]
            });

            return res.status(200).json({ success: true, data: result });
        } catch (error) {
            return res.status(500).json({ success: false, message: (error as Error).message })
        }
    } else {
        res.status(405).json({ success: false, message: 'Method not allowed' })
    }
}