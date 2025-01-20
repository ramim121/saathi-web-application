import { NextApiRequest, NextApiResponse } from 'next';
import { ProjectInvestmentBooking, ProjectInvestor, ProjectPartnerInvestor, ProjectPartner, Project, User, UserBank, Bank, BankBranch, File } from '@/models/__associations';
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
                                                model: User,
                                                include: [{
                                                    model: File,
                                                    as: 'ProfilePicture',
                                                }]
                                            }
                                        ]

                                    }
                                ]
                            },
                            {
                                model: Project,
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


            return res.status(200).json({
                success: true,
                data: {
                    ...resultMain,
                    ProjectInvestors:
                        resultMain.ProjectInvestors.map((projectInvestor: any) => {
                            const projectInvestorMain = projectInvestor;
                            const createdAtDate = new Date(projectInvestorMain.createdAt);
                            // Add the duration in months to the createdAt date
                            createdAtDate.setMonth(createdAtDate.getMonth() + projectInvestorMain.Project.duration);
                            // Assign the formatted maturityDate
                            projectInvestorMain.maturityDate = createdAtDate.toISOString(); // ISO format
                            return projectInvestorMain;
                        })
                }
            });
        } catch (error) {
            return res.status(500).json({ success: false, message: (error as Error).message })
        }
    } else {
        res.status(405).json({ success: false, message: 'Method not allowed' })
    }
}