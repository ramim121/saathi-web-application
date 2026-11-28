import { NextApiRequest, NextApiResponse } from 'next';
import { User, File, ProjectPartner } from '@/models/__associations';
import sequelize from 'sequelize';
import { publicPartnerAttributes } from '@/utils/publicFields';
import { partnerUnitsSql } from '@/utils/bookingHolds';

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
                        /*
                         * SECURITY: public route. It returned every column of each
                         * partner's user row (phone, email, date of birth, NID
                         * fields) and their household/livelihood details. Public
                         * profile fields only, as the other public partner routes.
                         */
                        attributes: publicPartnerAttributes(),
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
                        ],
                        [
                            sequelize.literal(`(
                                SELECT COALESCE(SUM(ppi.invested_unit), 0)
                                FROM project_partner_investors AS ppi
                                JOIN project_investors AS pi ON ppi.id_project_investors = pi.id_project_investors
                                WHERE ppi.id_project_partners = ProjectPartner.id_project_partners AND pi.investment_status = 'confirmed'
                            )`),
                            'confirmedUnits'
                        ],
                        // Units held by unpaid bookings still within their payment window.
                        [sequelize.literal(partnerUnitsSql('ProjectPartner.id_project_partners', 'held')), 'reservedUnits']
                    ]
                },
                having: sequelize.literal(`
                    (partnerUnitCapacity = 0 OR confirmedUnits + reservedUnits < partnerUnitCapacity)
                `),
                order: [
                    [sequelize.literal('confirmedUnits'), 'ASC'],
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