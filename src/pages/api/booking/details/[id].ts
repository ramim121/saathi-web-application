import { NextApiRequest, NextApiResponse } from 'next';
import { ProjectInvestmentBooking, ProjectInvestor, ProjectPartnerInvestor, ProjectPartner, Project, User } from '@/models/__associations';

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
                                        include: [
                                            {
                                                model: User
                                            }
                                        ]

                                    }
                                ]
                            },
                            {
                                model: Project,
                            }
                        ]
                    }
                ]
            });

            return res.status(200).json({ success: true, data: result });
        } catch (error) {
            return res.status(500).json({ success: false, message: (error as Error).message })
        }
    } else {
        res.status(405).json({ success: false, message: 'Method not allowed' })
    }
}