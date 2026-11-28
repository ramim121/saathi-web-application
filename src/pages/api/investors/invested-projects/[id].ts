import { NextApiRequest, NextApiResponse } from 'next';
import { User, ProjectPartner, ProjectPartnerInvestor, Project, ProjectInvestor, ProjectInvestmentBooking, File, ProjectInvestmentBookingStatus } from '@/models/__associations';
import { withCors, requireUser, canAccess } from '@/utils/auth';
import { publicPartnerAttributes } from '@/utils/publicFields';
import { holdFields } from '@/utils/bookingHolds';

/**
 * An investor's investments — the app's My Investments, My Invested Projects
 * and Pending Proof screens.
 *
 * SECURITY: this took the user id from the URL and checked nothing, so anyone
 * could read any investor's investments, amounts and full user record (phone,
 * date of birth, NID image names), plus every partner's full record. The app
 * always sends the signed-in user's token and their own id, so this now
 * requires that token and that id (or an admin), and partners carry only
 * their public profile fields.
 */
async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    if (req.method === 'GET') {
        try {

            const result = await ProjectInvestor.findAll({
                include: [
                    Project,
                    {
                        model: ProjectPartnerInvestor,
                        include: [
                            {
                                model: ProjectPartner,
                                include: [
                                    { model: Project },
                                    { model: User, attributes: publicPartnerAttributes(), include: [{ model: File, as: 'ProfilePicture' }] }
                                ]
                            }
                        ]
                    },
                    {
                        model: User,
                        where: {
                            idUsers: req.query.id
                        },
                        include: [{ model: File, as: 'ProfilePicture' }]
                    },
                    {
                        model: ProjectInvestmentBooking,
                        include: [
                            {
                                model: ProjectInvestmentBookingStatus,
                                where: {
                                    status: 'confirmed'
                                },
                                required: false
                            }
                        ],
                        where: {
                            cancelled: 'no'
                        }
                    }
                ],
                order: [['idProjectInvestmentBookings', 'DESC']]
            });

            const enhancedResult = result.map((investment: any) => {
                const investmentDate = investment?.ProjectInvestmentBooking?.paymentDate ? new Date(investment.ProjectInvestmentBooking.paymentDate) : new Date(investment.investmentDate);
                const duration = investment.ProjectPartnerInvestors?.[0]?.ProjectPartner?.Project?.duration || 0;
                const tenure = investment.ProjectPartnerInvestors?.[0]?.ProjectPartner?.Project?.tenure || 'months';

                let projectStartDate = null;
                let projectEndDate = null;

                // const endDate = investment.ProjectInvestmentBooking?.ProjectInvestmentBookingStatuses?.[0]?.dataValues.createdAt
                //     ? new Date(investment.ProjectInvestmentBooking?.ProjectInvestmentBookingStatuses?.[0]?.dataValues.createdAt)
                //     : null;

                const endDate = new Date(investmentDate);

                if (endDate) {
                    if (tenure === 'months') {
                        endDate.setMonth(endDate.getMonth() + duration); // Add months to investmentDate
                        projectStartDate = investmentDate.toISOString().split('T')[0]; // Format as 'YYYY-MM-DD'
                        projectEndDate = endDate.toISOString().split('T')[0]; // Format as 'YYYY-MM-DD'
                    }
                    else if (tenure === 'years') {
                        endDate.setFullYear(endDate.getFullYear() + duration); // Add years to investmentDate
                        projectStartDate = investmentDate.toISOString().split('T')[0]; // Format as 'YYYY-MM-DD'
                        projectEndDate = endDate.toISOString().split('T')[0]; // Format as 'YYYY-MM-DD'
                    }
                }

                const json = investment.toJSON();
                // The booking's payment deadline and derived state (utils/bookingHolds.ts).
                if (json.ProjectInvestmentBooking) json.ProjectInvestmentBooking = { ...json.ProjectInvestmentBooking, ...holdFields(json.ProjectInvestmentBooking) };
                return {
                    ...json,
                    projectStartDate,
                    projectEndDate
                };
            });

            return res.status(200).json({ success: true, data: enhancedResult });

        } catch (error) {
            return res.status(400).json({ success: false, message: (error as Error).message })
        }
    } else {
        res.status(405).json({ success: false, message: 'Method not allowed' })
    }
}

export default withCors(requireUser(async (req, res, auth) => {
    if (!canAccess(auth, req.query.id as string)) {
        return res.status(403).json({ success: false, message: 'Access denied' });
    }
    return handler(req, res);
}));