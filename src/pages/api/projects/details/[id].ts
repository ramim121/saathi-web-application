import { NextApiRequest, NextApiResponse } from 'next';
import { Project } from '@/models/__associations';
import { User, ProjectPartner, File, ProjectInvestor, ProjectInvestmentBooking, ProjectCategory } from '@/models/__associations';
import sequelize from '@/config/db';
// import jwt from 'jsonwebtoken';
// import { JWT_SECRET } from '@/config/constants';
// import JWTPayload from '@/types/JWTPayload';

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    if (req.method === 'GET') {
        // let tokenData = req.headers.authorization;
        // let token = tokenData?.split(' ')[1];

        // if (!token || jwt.verify(token, JWT_SECRET) === null) { res.status(401).json({ success: false, message: 'Invalid token' }); return; }

        // let userInfo = jwt.decode(token) as JWTPayload;
        // if (userInfo.userType !== 'admin') { res.status(403).json({ success: false, message: 'Access denied' }); return; }

        try {

            const result = await Project.findOne({
                include: [
                    { model: User, as: 'CreatedBy', attributes: ['fullName'] },
                    {
                        model: ProjectPartner, as: 'ProjectPartners',
                        include: [
                            {
                                model: User,
                                include: [
                                    { model: File, as: 'ProfilePicture' }
                                ]
                            }
                        ]
                    },
                    {
                        model: ProjectInvestor, as: 'ProjectInvestors',
                        include: [
                            {
                                model: User,
                            },
                            {
                                model: ProjectInvestmentBooking,
                            }
                        ]
                    },
                    {
                        model: File, as: 'MainImage'
                    },
                    {
                        model: File, as: 'FeaturedImages'
                    },
                    {
                        model: ProjectCategory,
                        as: 'ProjectCategory'
                    },

                ],
                attributes: {
                    include: [
                        [
                            sequelize.literal(`(
								SELECT SUM(unit_purchased)
								FROM project_investors AS ppi
								WHERE ppi.id_projects = Project.id_projects
							)`),
                            'totalInvestedUnits'
                        ],
                        [
                            sequelize.literal(`
                                CASE
                                    WHEN Project.total_available_units != 0 THEN Project.total_available_units - (
                                        SELECT SUM(unit_purchased)
                                        FROM project_investors AS ppi
                                        WHERE ppi.id_projects = Project.id_projects
                                    )
                                    ELSE NULL
                                END
                            `),
                            'totalRemainingUnits'
                        ]
                    ]
                },
                where: {
                    idProjects: req.query.id
                },
            });

            return res.status(200).json({ success: true, data: result });
        } catch (error) {
            return res.status(500).json({ success: false, message: (error as Error).message })
        }
    } else {
        res.status(405).json({ success: false, message: 'Method not allowed' })
    }
}