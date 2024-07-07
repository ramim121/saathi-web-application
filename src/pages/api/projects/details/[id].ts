import { NextApiRequest, NextApiResponse } from 'next';
import { Project } from '@/models/__associations';
import { User, ProjectPartner, File } from '@/models/__associations';

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    if (req.method === 'GET') {
        try {

            const result = await Project.findOne({
                include: [
                    { model: User, as: 'CreatedBy', attributes: ['fullName'] },
                    {
                        model: ProjectPartner, as: 'ProjectPartners',
                        include: [
                            {
                                model: User,
                                include: [
                                    { model: File, as: 'ProfilePicture' }
                                ]
                            }
                        ]
                    },
                    {
                        model: File, as: 'MainImage'
                    },
                    {
                        model: File, as: 'FeaturedImages'
                    }

                ],
                where: {
                    idProjects: req.query.id
                },
            });

            return res.status(200).json({ success: true, data: result });
        } catch (error) {
            return res.status(500).json({ success: false, message: (error as Error).message })
        }
    } else {
        res.status(405).json({ success: false, message: 'Method not allowed' })
    }
}