import { NextApiRequest, NextApiResponse } from 'next';
import { User, File, ProjectPartner } from '@/models/__associations';
import sequelize from 'sequelize';

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
                ],
                attributes: {
                    include: [
                        [
                            sequelize.literal(`(
                                SELECT COUNT(*)
                                FROM project_partner_investors AS ppi
                                JOIN project_investors AS pi ON ppi.id_project_investors = pi.id_project_investors
                                WHERE ppi.id_project_partners = ProjectPartner.id_project_partners AND pi.investment_status = 'confirmed'
                            )`),
                            'investorCount'
                        ]
                    ]
                },
                having: sequelize.literal(`
                    (partnerUnitCapacity = 0 OR investorCount < partnerUnitCapacity)
                `),
                order: [
                    [sequelize.literal('investorCount'), 'ASC'],
                    ['idProjectPartners', 'ASC']
                ]
            });

            return res.status(200).json({ success: true, data: result });
        } catch (error) {
            return res.status(400).json({ success: false, message: (error as Error).message });
        }
    } else {
        res.status(405).json({ success: false, message: 'Method not allowed' });
    }
}