import { NextApiRequest, NextApiResponse } from 'next';
import { Project, ProjectPartnerInvestor } from '@/models/__associations';
import { User, ProjectPartner, File, ProjectInvestor, ProjectInvestmentBooking, ProjectCategory } from '@/models/__associations';
import sequelize from '@/config/db';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '@/config/constants';
import JWTPayload from '@/types/JWTPayload';
import Cors from 'micro-cors';
import ProjectProperty from '@/models/ProjectProperty';
import { partnerUnitsSql, projectRemainingSql, projectUnitsSql } from '@/utils/bookingHolds';
const cors = Cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS', 'PUT'],
    allowHeaders: ['X-Requested-With', 'Authorization', 'Content-Type'],
});
/*
 * Units use capacity when paid or held by an unpaid booking still within its
 * payment window (utils/bookingHolds.ts).
 *
 *   totalInvestedUnits   paid units (unchanged)
 *   totalRemainingUnits  total - paid - held; NULL only when the project has
 *                        no total. The app reads it as the project's room.
 *   paidUnits, reservedUnits, availableUnits  the same, spelled out
 *
 * A partner's `alreadyInvestedUnits` is paid + held on the PUBLIC response:
 * the shipped app's only use of it is the partner's room (capacity minus
 * it), so installed builds show the right room with no app release. The
 * admin response keeps paid units only. Both add `paidUnits` and
 * `reservedUnits`.
 */
const PARTNER = 'ProjectPartners.id_project_partners';
const partnerFields = (alreadyInvested: 'paid' | 'used'): [ReturnType<typeof sequelize.literal>, string][] => [
    [sequelize.literal(partnerUnitsSql(PARTNER, alreadyInvested)), 'alreadyInvestedUnits'],
    [sequelize.literal(partnerUnitsSql(PARTNER, 'paid')), 'paidUnits'],
    [sequelize.literal(partnerUnitsSql(PARTNER, 'held')), 'reservedUnits'],
];
const projectUnitFields: [ReturnType<typeof sequelize.literal>, string][] = [
    [sequelize.literal(projectUnitsSql('Project.id_projects', 'paid')), 'totalInvestedUnits'],
    [sequelize.literal(projectRemainingSql('Project.id_projects', 'Project.total_available_units')), 'totalRemainingUnits'],
    [sequelize.literal(projectUnitsSql('Project.id_projects', 'paid')), 'paidUnits'],
    [sequelize.literal(projectUnitsSql('Project.id_projects', 'held')), 'reservedUnits'],
    [sequelize.literal(projectRemainingSql('Project.id_projects', 'Project.total_available_units')), 'availableUnits'],
];

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
                        ProjectProperty,
                        { model: User, as: 'CreatedBy', attributes: ['fullName'] },
                        {
                            model: ProjectPartner, as: 'ProjectPartners',
                            attributes: {
                                exclude: [
                                    'createdAt',
                                    'updatedAt',
                                ],
                                include: [
                                    ...partnerFields('used'),
                                ]
                            },
                            include: [
                                {
                                    model: User,
                                    // SECURITY: public route — `phoneNumber` removed (no app
                                    // screen reads a partner's phone). `disability` stays: the
                                    // app renders it as a badge on this payload.
                                    attributes: ['idUsers', 'fullName', 'role', 'location', 'interestedIn', 'disability', 'joiningDate', 'age', 'skills', 'bio',
                                        'fullNameBn', 'roleBn', 'locationBn', 'interestedInBn', 'skillsBn', 'bioBn'],
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
                            ...projectUnitFields
                        ]
                    },
                    where: {
                        idProjects: req.query.id
                    },
                });
                return res.status(200).json({ success: true, data: result });

            }
        } catch (error) {
            return res.status(400).json({ success: false, message: (error as Error).message })
        }
    } else {
        res.status(405).json({ success: false, message: 'Method not allowed' })
    }
}

export async function getProjectDetails(projectId: string) {
    return Project.findOne({
        include: [
            ProjectProperty,
            { model: User, as: 'CreatedBy', attributes: ['fullName'] },
            {
                model: ProjectInvestor, as: 'ProjectInvestors',
                /*
                 * Named columns only. A bare `User` here returned every column
                 * of every investor's and partner's user row (email, date of
                 * birth, Google/Apple ids, NID fields…) into the admin page's
                 * server-rendered data. The page shows name, phone and photo.
                 */
                include: [{ model: User, attributes: ['idUsers', 'fullName', 'phoneNumber', 'profileImage'] }, ProjectInvestmentBooking,
                    {
                        model: ProjectPartnerInvestor,
                        include: [{
                            model: ProjectPartner,
                            include: [{ model: User, attributes: ['idUsers', 'fullName'] }]
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
                        ...partnerFields('paid'),
                    ]
                },
                include: [
                    {
                        model: User,
                        // Admin only (the page and the admin branch of this route both
                        // check), so the partner's phone is back: the Partners tab shows it.
                        attributes: ['idUsers', 'fullName', 'phoneNumber', 'role', 'location', 'interestedIn', 'disability', 'joiningDate',
                            'fullNameBn', 'roleBn', 'locationBn', 'interestedInBn'],
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
                ...projectUnitFields
            ]
        },
        where: {
            idProjects: projectId
        }
    });
}

export default cors(handler as any);
