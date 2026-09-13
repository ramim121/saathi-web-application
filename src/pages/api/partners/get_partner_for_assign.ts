import { NextApiRequest, NextApiResponse } from 'next'
import { User, ProjectPartner, Project, ProjectPartnerInvestor, ProjectInvestor, ProjectInvestmentBooking } from '@/models/__associations'
import { Op } from 'sequelize'
import sequelize from '@/config/db';

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
): Promise<void> {
    if (req.method === 'GET') {
        try {
            const result = await User.findAll({
                attributes: [
                    'idUsers',
                    'fullName',
                    'phoneNumber',
                    'age',
                    'location',
                    'role',
                    'joiningDate',
                    'skills'
                ],
                include: [
                    {
                        model: ProjectPartner,
                        as: 'Partnerships',
                        attributes: {
                            include: [
                                [
                                    sequelize.literal(`(
                                        SELECT IFNULL(SUM(invested_unit),0)
                                        FROM project_partner_investors AS ppi
                                        JOIN project_investors AS pi ON ppi.id_project_investors = pi.id_project_investors
                                        WHERE ppi.id_project_partners = Partnerships.id_project_partners
                                        AND pi.investment_status = 'confirmed'
                                    )`),
                                    'alreadyInvested'
                                ]
                            ]
                        },
                        include: [
                            {
                                model: Project,
                                as: 'Project',
                                attributes: ['projectName', 'location', 'idProjects']
                            },
                            {
                                model: ProjectPartnerInvestor,
                                as: 'ProjectPartnerInvestors',  // Ensure the alias matches the association
                                include: [
                                    {
                                        model: ProjectInvestor,
                                        include: [
                                            {
                                                model: ProjectInvestmentBooking,
                                                where: { cancelled: 'no' }
                                            },
                                            { model: User }
                                        ]
                                    }
                                ]
                            }
                        ],
                        // Add subQuery: false here to prevent issues with nested includes
                        subQuery: false
                    }
                ],
                where: {
                    userType: 'partner',
                    partnerType: {
                        [Op.or]: ['project', 'both']
                    }
                }
            });

            return res.status(200).json({ success: true, data: result });
        } catch (error) {
            return res.status(400).json({ success: false, message: (error as Error).message });
        }
    } else {
        res.status(405).json({ success: false, message: 'Method not allowed' });
    }
}
