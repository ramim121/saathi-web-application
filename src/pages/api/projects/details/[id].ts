import { NextApiRequest, NextApiResponse } from 'next';
import { Project } from '@/models/__associations';
import { User, ProjectPartner } from '@/models/__associations';

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    if (req.method === 'GET') {
        try {

            const result = await Project.findOne({
                include: [
                    { model: User, as: 'CreatedBy', attributes: ['fullName'] },
                    {
                        model: ProjectPartner, as: 'ProjectPartners',
                        include: [
                            { model: User, attributes: ['fullName'] }
                        ]
                    }
                ],
                where: {
                    idProjects: req.query.id
                },
            });

            return res.status(200).json(result);
        } catch (error) {
            return res.status(500).json({ error: 'Server error' });
        }
    } else {
        res.status(405).json({ error: 'Method not allowed' });
    }
}