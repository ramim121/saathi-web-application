import { NextApiRequest, NextApiResponse } from 'next';
import { Project, ProjectPartnerInvestor } from '@/models/__associations';
import { User, ProjectPartner, File, ProjectInvestor, ProjectInvestmentBooking, ProjectCategory } from '@/models/__associations';
import sequelize from '@/config/db';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '@/config/constants';
import JWTPayload from '@/types/JWTPayload';
import Cors from 'micro-cors';
const cors = Cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS', 'PUT'],
    allowHeaders: ['X-Requested-With', 'Authorization', 'Content-Type'],
});
async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'OPTIONS') { return res.status(200).end(); }
    if (req.method === 'GET') {
        try {
            let userType = '';
            try {
                let tokenData = req.headers.authorization;
                let token = tokenData?.split(' ')[1];
                if (token) {
                    jwt.verify(token, JWT_SECRET);
                    let userInfo = jwt.decode(token) as JWTPayload;
                    userType = userInfo.userType;
                }

            } catch (error) { }

            if (userType && userType == 'admin') {

                const result = await getProjectDetails(req.query.id as string);

                return res.status(200).json({ success: true, data: result });
            }
            else {
                const result = await Project.findOne({
                    include: [
                        { model: User, as: 'CreatedBy', attributes: ['fullName'] },
                        {
                            model: ProjectPartner, as: 'ProjectPartners',
                            attributes: {
                                exclude: [
                                    'createdAt',
                                    'updatedAt',
                                ],
                                include: [
                                    [
                                        sequelize.literal(`(
                                        SELECT IFNULL(SUM(invested_unit),0)
                                        FROM project_partner_investors AS ppi
                                        LEFT JOIN project_investors AS pi ON pi.id_project_investors = ppi.id_project_investors
                                        WHERE ppi.id_project_partners = ProjectPartners.id_project_partners and pi.investment_status != 'cancelled'
                                    )`),
                                        'alreadyInvestedUnits'
                                    ],
                                ]
                            },
                            include: [
                                {
                                    model: User,
                                    attributes: ['fullName', 'role', 'location', 'interestedIn', 'disability', 'joiningDate', 'phoneNumber'],
                                    include: [
                                        { model: File, as: 'ProfilePicture' }
                                    ]
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
								SELECT IFNULL(SUM(unit_purchased),0)
								FROM project_investors AS ppi
								WHERE ppi.id_projects = Project.id_projects AND ppi.investment_status != 'cancelled'
							)`),
                                'totalInvestedUnits'
                            ],
                            [
                                sequelize.literal(`
                                CASE
                                    WHEN Project.total_available_units != 0 THEN Project.total_available_units - (
                                        SELECT IFNULL(SUM(unit_purchased),0)
                                        FROM project_investors AS ppi
                                        WHERE ppi.id_projects = Project.id_projects AND ppi.investment_status != 'cancelled'
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

            }
        } catch (error) {
            return res.status(500).json({ success: false, message: (error as Error).message })
        }
    } else {
        res.status(405).json({ success: false, message: 'Method not allowed' })
    }
}

export async function getProjectDetails(projectId: string) {
    return Project.findOne({
        include: [
            { model: User, as: 'CreatedBy', attributes: ['fullName'] },
            {
                model: ProjectInvestor, as: 'ProjectInvestors',
                include: [User, ProjectInvestmentBooking,
                    {
                        model: ProjectPartnerInvestor,
                        include: [{
                            model: ProjectPartner,
                            include: [User]
                        }]
                    }
                ]
            },
            {
                model: ProjectPartner, as: 'ProjectPartners',
                attributes: {
                    exclude: [
                        'createdAt',
                        'updatedAt',
                    ],
                    include: [
                        [
                            sequelize.literal(`(
                            SELECT IFNULL(SUM(invested_unit),0)
                            FROM project_partner_investors AS ppi
                            LEFT JOIN project_investors AS pi ON pi.id_project_investors = ppi.id_project_investors
                            WHERE ppi.id_project_partners = ProjectPartners.id_project_partners and pi.investment_status != 'cancelled'
                        )`),
                            'alreadyInvestedUnits'
                        ],
                    ]
                },
                include: [
                    {
                        model: User,
                        attributes: ['fullName', 'role', 'location', 'interestedIn', 'disability', 'joiningDate', 'phoneNumber'],
                        include: [
                            { model: File, as: 'ProfilePicture' }
                        ]
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
        where: {
            idProjects: projectId
        }
    });
}

export default cors(handler as any);
