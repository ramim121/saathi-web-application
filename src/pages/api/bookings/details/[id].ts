import { NextApiRequest, NextApiResponse } from 'next';
import { ProjectInvestmentBooking, ProjectInvestor, ProjectPartnerInvestor, ProjectPartner, Project, User, UserBank, Bank, BankBranch, ProjectInvestmentBookingStatus, ProjectInvestorStatus, File, ProjectSpecialBookingReq } from '@/models/__associations';
import sequelize from '@/config/db';
// WHERE ppi.id_project_partners = ProjectPartner.id_project_partners

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
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
                                            [
                                                sequelize.literal(`(
                                                    partner_unit_capacity - (
                                                        SELECT IFNULL(SUM(invested_unit),0)
                                                        FROM project_partner_investors AS ppi
                                                        LEFT JOIN project_investors AS pi ON pi.id_project_investors = ppi.id_project_investors
                                                        WHERE ppi.id_project_partners = \`ProjectInvestors->ProjectPartnerInvestors->ProjectPartner\`.id_project_partners
                                                        AND pi.investment_status = 'confirmed'
                                                    )
                                                )`),
                                                'remainingCapacity'
                                            ]
                                        ],
                                        include: [
                                            {
                                                model: User,
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
                        model: UserBank,
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

            const resultMain = result?.get({ plain: true });

            const bookingHistory = await ProjectInvestmentBookingStatus.findAll({
                where: {
                    idProjectInvestmentBookings: req.query.id
                },
                include: [
                    {
                        model: User
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
                        model: User
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