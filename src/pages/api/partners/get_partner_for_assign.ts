import { NextApiRequest, NextApiResponse } from 'next'
import { User, ProjectPartner, Project, ProjectPartnerInvestor, ProjectInvestor } from '@/models/__associations'
import { Op } from 'sequelize'
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '@/config/constants';
import JWTPayload from '@/types/JWTPayload';
export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
): Promise<void> {
    if (req.method === 'GET') {
        try {
            const result = await User.findAll({
                attributes: [
                    'idUsers',
                    'fullName',
                    'phoneNumber',
                    'age',
                    'location',
                    'role',
                    'joiningDate',
                    'skills'
                ],
                include: [
                    {
                        model: ProjectPartner, as: 'Partnerships',
                        include: [
                            { model: Project, as: 'Project', attributes: ['projectName', 'location', 'idProjects'] },
                            { model: ProjectPartnerInvestor, include: [{ model: ProjectInvestor, include: [User] }] }
                        ]

                    }],
                where: {
                    userType: 'partner',
                    partnerType: {
                        [Op.or]: ['project', 'both']
                    }
                }
            })


            return res.status(200).json({ success: true, data: result })
        } catch (error) {
            return res.status(500).json({ success: false, message: (error as Error).message })
        }
    } else {
        res.status(405).json({ success: false, message: 'Method not allowed' })
    }
}