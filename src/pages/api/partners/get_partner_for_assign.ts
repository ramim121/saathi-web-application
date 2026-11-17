import { NextApiRequest, NextApiResponse } from 'next'
import { User, ProjectPartner, Project, ProjectPartnerInvestor, ProjectInvestor, ProjectInvestmentBooking } from '@/models/__associations'
import { Op } from 'sequelize'
import sequelize from '@/config/db';
import { withCors, requireAdmin } from '@/utils/auth';

/**
 * Partners with their partnerships, for the admin's Assign partners page.
 *
 * SECURITY: this route had no sign-in check. Anyone could fetch every
 * partner's phone number, and — through `ProjectInvestor → User` with no
 * attribute list — the full user record of every investor allocated to them,
 * plus their booking rows. It is admin-only now, and the nested investor and
 * booking rows carry only what the page shows (booking number and link).
 */
async function handler(
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
                                attributes: ['idProjectPartnerInvestors', 'investedUnit'],
                                include: [
                                    {
                                        model: ProjectInvestor,
                                        attributes: ['idProjectInvestors', 'investmentStatus'],
                                        include: [
                                            {
                                                model: ProjectInvestmentBooking,
                                                attributes: ['idProjectInvestmentBookings', 'bookingId'],
                                                where: { cancelled: 'no' }
                                            },
                                            { model: User, attributes: ['idUsers', 'fullName'] }
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

export default withCors(requireAdmin(handler));
