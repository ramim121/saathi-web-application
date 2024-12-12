import { NextApiRequest, NextApiResponse } from 'next';
import { User, File, ProjectPartner, Project, ProjectPartnerInvestor, ProjectInvestor, ProjectInvestmentBooking } from '@/models/__associations';
import sequelize from '@/config/db';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '@/config/constants';
import JWTPayload from '@/types/JWTPayload';

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    if (req.method === 'GET') {
        // let tokenData = req.headers.authorization;
        // let token = tokenData?.split(' ')[1];

        // if (!token || jwt.verify(token, JWT_SECRET) === null) { res.status(401).json({ success: false, message: 'Invalid token' }); return; }

        // let userInfo = jwt.decode(token) as JWTPayload;
        // if (userInfo.userType !== 'admin') { res.status(403).json({ success: false, message: 'Access denied' }); return; }
        try {

            const result = await User.findOne({
                where: {
                    idUsers: req.query.id
                },
                include: [
                    { model: File, as: 'ProfilePicture' },
                    { model: File, as: 'FeaturedImages' },
                    {
                        model: ProjectPartner, as: 'Partnerships',
                        attributes: [
                            'partnerUnitCapacity',
                            [
                                sequelize.literal(`(
                                SELECT IFNULL(SUM(invested_unit),0)
                                FROM project_partner_investors AS ppi
                                LEFT JOIN project_investors AS pi ON pi.id_project_investors = ppi.id_project_investors
                                WHERE ppi.id_project_partners = Partnerships.id_project_partners and pi.investment_status != 'cancelled'
                            )`),
                                'alreadyInvestedUnits'
                            ],
                        ],
                        include: [
                            {
                                model: Project, as: 'Project',
                                include: [
                                    {
                                        model: File, as: 'MainImage'
                                    }
                                ]
                            },
                            {
                                model: ProjectPartnerInvestor,
                                required: false,
                                include: [
                                    {
                                        model: ProjectInvestor,
                                        include: [
                                            {
                                                model: ProjectInvestmentBooking
                                            }
                                        ]
                                    }
                                ]

                            }
                        ]

                    }],
            });

            return res.status(200).json({ success: true, data: result });
        } catch (error) {
            return res.status(500).json({ success: false, message: (error as Error).message })
        }
    } else {
        res.status(405).json({ success: false, message: 'Method not allowed' })
    }
}