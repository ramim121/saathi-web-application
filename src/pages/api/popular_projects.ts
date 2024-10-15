import { NextApiRequest, NextApiResponse } from 'next';
import { Project, File, ProjectInvestor } from '@/models/__associations';
import sequelize from '@/config/db';
import { Op } from 'sequelize';

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    if (req.method === 'GET') {
        try {

            const result = await Project.findAll(
                {
                    include: [
                        {
                            model: File, as: 'MainImage', required: false
                        },
                        {
                            model: ProjectInvestor,
                            as: 'ProjectInvestors'
                        }
                    ],
                    attributes: {
                        include: [
                            [
                                sequelize.literal(`(
                                    SELECT COUNT(*)
                                    FROM project_investors AS ppi
                                    WHERE ppi.id_projects = Project.id_projects
                                )`),
                                'investorCount'
                            ]
                        ]
                    },
                    where: {
                        showInUpcoming: 'no',
                        projectStatus: { [Op.ne]: 'completed' }
                    },
                    order: [[sequelize.literal('investorCount'), 'DESC']],
                    limit: 5
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