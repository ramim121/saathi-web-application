import { NextApiRequest, NextApiResponse } from 'next'
import { Project, ProjectCategory, ProjectProperty } from '@/models/__associations'
import sequelize from '@/config/db';
import { Op } from 'sequelize';

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
): Promise<void> {
    if (req.method === 'GET') {

        try {
            const result = await Project.findAll({
                include: [
                    ProjectProperty,
                    {
                        model: ProjectCategory,
                        as: 'ProjectCategory'
                    },
                ],
                attributes: {
                    include: [
                        [
                            sequelize.literal(`(
                                SELECT COALESCE(SUM(unit_purchased), 0)
                                FROM project_investors AS ppi
                                WHERE ppi.id_projects = Project.id_projects
                                AND ppi.investment_status = 'confirmed'
                            )`),
                            'totalInvestedUnits'
                        ],
                        [
                            sequelize.literal(`
                                CASE
                                    WHEN Project.total_available_units != 0 THEN Project.total_available_units - (
                                        SELECT SUM(unit_purchased)
                                        FROM project_investors AS ppi
                                        WHERE ppi.id_projects = Project.id_projects
                                        AND ppi.investment_status = 'confirmed'
                                    )
                                    ELSE NULL
                                END
                            `),
                            'totalRemainingUnits'
                        ]
                    ]
                },
                where: {
                    projectStatus: {
                        [Op.notIn]: ['closed', 'completed']
                    },
                },
                having: sequelize.literal(`
                    (totalAvailableUnits = 0 OR totalInvestedUnits < totalAvailableUnits)
                `),
                order: [
                    [sequelize.literal(`CASE WHEN projectType = 'special' THEN 0 ELSE 1 END`), 'ASC']
                ]
            })

            return res.status(200).json({ success: true, data: result })
        } catch (error) {
            return res.status(400).json({ success: false, message: (error as Error).message })

        }
    } else {
        res.status(405).json({ success: false, message: 'Method not allowed' })
    }
}
