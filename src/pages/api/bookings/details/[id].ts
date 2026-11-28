import { NextApiRequest, NextApiResponse } from 'next';
import { ProjectInvestmentBooking, ProjectInvestor, ProjectPartnerInvestor, ProjectPartner, Project, User, UserBank, Bank, BankBranch, ProjectInvestmentBookingStatus, ProjectInvestorStatus, File, ProjectSpecialBookingReq } from '@/models/__associations';
import sequelize from '@/config/db';
import { withCors, requireUser, canAccess, type AuthContext } from '@/utils/auth';
import { publicPartnerAttributes } from '@/utils/publicFields';
import { holdFields, partnerUnitsSql } from '@/utils/bookingHolds';

const BOOKING_PARTNER = '`ProjectInvestors->ProjectPartnerInvestors->ProjectPartner`.id_project_partners';
// WHERE ppi.id_project_partners = ProjectPartner.id_project_partners

/**
 * Who changed a status, as the history list shows it ("by <name>"). The admin
 * page and the app read only the name; the rest of an admin's or investor's
 * row (phone, email, NID fields) has no business in another person's booking.
 */
const HISTORY_ACTOR_ATTRIBUTES = ['idUsers', 'fullName'];

/**
 * One booking with its lines, partners, bank and history — the admin's
 * booking page and the app's Order Details / My Order Details.
 *
 * SECURITY: this answered anyone, for any booking id: the investor's full
 * user record (phone, date of birth, NID image names, Google id), their bank
 * account, payment amounts and the history. SECURITY-REMEDIATION.md left it
 * open because the app calls it — but the app always sends the signed-in
 * user's token and opens only that user's own bookings (from the cart, the
 * bank-transfer screen and their investment lists). So it now requires a
 * token, and the booking must be the caller's own unless they are an admin.
 */
async function handler(req: NextApiRequest, res: NextApiResponse, auth: AuthContext): Promise<void> {
    if (req.method === 'GET') {
        try {

            const result = await ProjectInvestmentBooking.findOne({
                where: {
                    idProjectInvestmentBookings: req.query.id
                },
                include: [
                    {
                        model: ProjectInvestor,
                        include: [
                            {
                                model: ProjectPartnerInvestor,
                                include: [
                                    {
                                        model: ProjectPartner,
                                        attributes: [
                                            'partnerUnitCapacity',
                                            'idProjectPartners',
                                            [
                                                sequelize.literal(`(
                                                    SELECT IFNULL(SUM(invested_unit),0)
                                                    FROM project_partner_investors AS ppi
                                                    LEFT JOIN project_investors AS pi ON pi.id_project_investors = ppi.id_project_investors
                                                    WHERE ppi.id_project_partners = \`ProjectInvestors->ProjectPartnerInvestors->ProjectPartner\`.id_project_partners
                                                    AND pi.investment_status = 'confirmed'
                                                )`),
                                                'alreadyInvestedUnits'
                                            ],
                                            // Room left: paid units and live holds both count (utils/bookingHolds.ts).
                                            [sequelize.literal(`(partner_unit_capacity - ${partnerUnitsSql(BOOKING_PARTNER, 'used')})`), 'remainingCapacity'],
                                            [sequelize.literal(partnerUnitsSql(BOOKING_PARTNER, 'held')), 'reservedUnits']
                                        ],
                                        include: [
                                            {
                                                // The partner farmer. Public profile fields only:
                                                // this went to the investor with the partner's
                                                // whole user row — phone, email, date of birth,
                                                // NID number and NID image keys.
                                                model: User,
                                                attributes: publicPartnerAttributes(),
                                                include: [{
                                                    model: File,
                                                    as: 'ProfilePicture',
                                                }]
                                            }
                                        ],
                                    }
                                ],
                                attributes: [
                                    'amountInvested',
                                    'investedUnit',
                                    'idProjectPartnerInvestors',
                                ]
                            },
                            {
                                model: Project,
                            },
                            {
                                model: ProjectSpecialBookingReq,
                                required: false
                            }
                        ]
                    },
                    {
                        model: User
                    },
                    {
                        model: UserBank.unscoped(),
                        include: [
                            {
                                model: Bank
                            },
                            {
                                model: BankBranch
                            }
                        ]
                    }
                ]
            });

            if (!result) {
                return res.status(404).json({ success: false, message: 'Booking not found' });
            }
            if (!canAccess(auth, result.idUsers)) {
                // 404, as the website's v2 route does: a 403 would confirm the booking exists.
                return res.status(404).json({ success: false, message: 'Booking not found' });
            }

            const resultMain = result?.get({ plain: true });

            // A reinvestment: which booking its money came from (additive field;
            // the admin page links to it, other callers can ignore it).
            let reinvestmentSource: { idProjectInvestmentBookings: number | null; bookingId: string | null; projectName: string | null } | null = null;
            if (resultMain?.idSourceProjectInvestors) {
                const sourceLine: any = await ProjectInvestor.findByPk(resultMain.idSourceProjectInvestors, {
                    attributes: ['idProjectInvestors', 'idProjectInvestmentBookings'],
                    include: [
                        { model: ProjectInvestmentBooking, attributes: ['bookingId'] },
                        { model: Project, attributes: ['projectName'] },
                    ],
                });
                if (sourceLine) {
                    reinvestmentSource = {
                        idProjectInvestmentBookings: sourceLine.idProjectInvestmentBookings ?? null,
                        bookingId: sourceLine.ProjectInvestmentBooking?.bookingId ?? null,
                        projectName: sourceLine.Project?.projectName ?? null,
                    };
                }
            }

            const bookingHistory = await ProjectInvestmentBookingStatus.findAll({
                where: {
                    idProjectInvestmentBookings: req.query.id
                },
                include: [
                    {
                        model: User,
                        attributes: HISTORY_ACTOR_ATTRIBUTES
                    }
                ]
            });

            const investorIds = result?.ProjectInvestors?.map(investor => investor.idProjectInvestors) || [];

            const investorHistory = await ProjectInvestorStatus.findAll({
                where: {
                    idProjectInvestors: investorIds
                },
                include: [
                    {
                        model: User,
                        attributes: HISTORY_ACTOR_ATTRIBUTES
                    }
                ]
            });

            const mergedHistory = [...bookingHistory, ...investorHistory].sort((a, b) => {
                return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            }).map(entry => {
                return {
                    ...entry.dataValues,  // Assuming Sequelize object with dataValues
                    createdAtFormatted: new Date(entry.createdAt).toLocaleString('en-US', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: false
                    })
                };
            });

            return res.status(200).json({
                success: true, data: {
                    ...resultMain,
                    // The payment deadline (Dhaka end of day, in UTC) and the derived state.
                    ...holdFields(resultMain),
                    reinvestmentSource,
                    ProjectInvestors:
                        resultMain.ProjectInvestors.map((projectInvestor: any) => {
                            const projectInvestorMain = projectInvestor;
                            const investmentDate = resultMain.paymentDate ? new Date(resultMain.paymentDate) : new Date(projectInvestor.investmentDate);
                            const duration = projectInvestor.Project.duration || 0;
                            const tenure = projectInvestor.Project.tenure || 'months';
                            let projectStartDate = null;
                            let projectEndDate = null;
                            const endDate = new Date(investmentDate);
                            if (endDate) {
                                if (tenure === 'months') {
                                    endDate.setMonth(endDate.getMonth() + duration); // Add months to investmentDate
                                    projectStartDate = investmentDate.toISOString().split('T')[0]; // Format as 'YYYY-MM-DD'
                                    projectEndDate = endDate.toISOString().split('T')[0]; // Format as 'YYYY-MM-DD'
                                } else if (tenure === 'years') {
                                    endDate.setFullYear(endDate.getFullYear() + duration); // Add years to investmentDate
                                    projectStartDate = investmentDate.toISOString().split('T')[0]; // Format as 'YYYY-MM-DD'
                                    projectEndDate = endDate.toISOString().split('T')[0]; // Format as 'YYYY-MM-DD'
                                }
                            }
                            projectInvestorMain.projectStartDate = projectStartDate;
                            projectInvestorMain.maturityDate = projectEndDate;
                            return projectInvestorMain;
                        })
                }, history: mergedHistory
            });
        } catch (error) {
            return res.status(400).json({ success: false, message: (error as Error).message })
        }
    } else {
        res.status(405).json({ success: false, message: 'Method not allowed' })
    }
}

export default withCors(requireUser(handler));