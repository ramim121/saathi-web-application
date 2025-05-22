import { NextApiRequest, NextApiResponse } from 'next';
import { User, ProjectPartner, ProjectPartnerInvestor, Project, ProjectInvestor, ProjectInvestmentBooking, File, ProjectInvestmentBookingStatus } from '@/models/__associations';

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
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
                                    { model: User, include: [{ model: File, as: 'ProfilePicture' }] }
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
                        ]
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

                return {
                    ...investment.toJSON(),
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