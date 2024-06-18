import { NextApiRequest, NextApiResponse } from 'next';
import { User, File, ProjectPartner, Project } from '@/models/__associations';

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    if (req.method === 'GET') {
        try {

            const result = await User.findOne({
                where: {
                    idUsers: req.query.id
                },
                include: [
                    { model: File, as: 'ProfilePicture' },
                    { model: File, as: 'FeaturedImages' },
                    {
                        model: ProjectPartner, as: 'Partnerships',
                        include: [
                            { model: Project, as: 'Project', attributes: ['projectName', 'location'] }
                        ]

                    }],
            });

            return res.status(200).json({ success: true, data: result });
        } catch (error) {
            return res.status(500).json({ success: false, message: (error as Error).message })
        }
    } else {
        res.status(405).json({ success: false, message: 'Method not allowed' })
    }
}