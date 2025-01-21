import { NextApiRequest, NextApiResponse } from 'next';
import { User, File } from '@/models/__associations';
import sequelize from '@/config/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
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
                    'bio',
                    'interestedIn',
                    'skills',
                    'joiningDate',
                    'education',
                    'disability',
                    [
                        sequelize.literal(`(
                                            SELECT COUNT(*)
                                            FROM project_partners
                                            JOIN project_partner_investors AS ppi ON project_partners.id_project_partners = ppi.id_project_partners
                                            JOIN project_investors AS pi ON ppi.id_project_investors = pi.id_project_investors
                                            WHERE project_partners.id_users = User.id_users AND pi.investment_status = 'confirmed'
                                        )`),
                        'investorCount'
                    ],

                ],
                include: [
                    { model: File, as: 'ProfilePicture' },
                ],
                limit: 5,
                where: {
                    user_type: 'partner',
                },
                order: [[sequelize.literal('investorCount'), 'DESC']]
            });

            res.status(200).json({ success: true, data: result });
        } catch (error) {
            return res.status(500).json({ success: false, message: (error as Error).message })
        }
    } else {
        res.status(405).json({ success: false, message: 'Method not allowed' })
    }
}