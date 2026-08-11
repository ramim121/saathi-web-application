import { NextApiRequest, NextApiResponse } from 'next';
import { User, File, PartnerAdditionalInfo } from '@/models/__associations';
import sequelize from '@/config/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    if (req.method === 'GET') {
        try {

            const result = await User.findAll({
                attributes: [
                    // SECURITY: public endpoint — `phoneNumber` removed. No app screen
                    // reads a partner's phone; the admin listing keeps its own projection.
                    'idUsers',
                    'fullName',
                    'age',
                    'location',
                    'role',
                    'bio',
                    'interestedIn',
                    'skills',
                    'joiningDate',
                    'education',
                    'disability',
                    // Bangla counterparts, so the Bangla site can render this
                    // homepage list without a second request.
                    'fullNameBn',
                    'roleBn',
                    'bioBn',
                    'skillsBn',
                    'locationBn',
                    'interestedInBn',
                    'educationBn',
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
                    { model: PartnerAdditionalInfo, as: 'PartnerAdditionalInfo' },
                ],
                limit: 5,
                where: {
                    user_type: 'partner',
                },
                order: [[sequelize.literal('investorCount'), 'DESC']]
            });

            res.status(200).json({ success: true, data: result });
        } catch (error) {
            return res.status(400).json({ success: false, message: (error as Error).message })
        }
    } else {
        res.status(405).json({ success: false, message: 'Method not allowed' })
    }
}