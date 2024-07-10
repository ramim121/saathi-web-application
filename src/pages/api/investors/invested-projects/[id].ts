import { NextApiRequest, NextApiResponse } from 'next';
import { User, ProjectPartner, ProjectPartnerInvestor, Project, ProjectInvestor, ProjectInvestmentBooking, File } from '@/models/__associations';

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    if (req.method === 'GET') {
        try {

            const result = await ProjectInvestor.findAll({
                include: [
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