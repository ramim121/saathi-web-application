import { NextApiRequest, NextApiResponse } from 'next';
import { Project, File } from '@/models/__associations';
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
                        }
                    ],
                    attributes: {
                        include: [
                            [
                                sequelize.literal(`(
                                    SELECT COUNT(*)
                                    FROM project_investors AS ppi
                                    WHERE ppi.id_projects = Project.id_projects
                                    AND ppi.investment_status = 'confirmed'
                                )`),
                                'investorCount'
                            ]
                        ]
                    },
                    where: {
                        showInUpcoming: 'no',
                        projectStatus: { [Op.ne]: 'completed' }
                    },
                    order: [
                        [sequelize.literal(`CASE WHEN projectType = 'special' THEN 0 ELSE 1 END`), 'ASC'],
                        [sequelize.literal('investorCount'), 'DESC']
                    ],
                    limit: 5
                }
            )

            res.status(200).json({ success: true, data: result });
        } catch (error) {
            return res.status(400).json({ success: false, message: (error as Error).message })
        }
    } else {
        res.status(405).json({ success: false, message: 'Method not allowed' })
    }
}