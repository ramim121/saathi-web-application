import { NextApiRequest, NextApiResponse } from 'next'
import { Project, ProjectPartner } from '@/models/__associations'
import { Op } from 'sequelize'

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
): Promise<void> {
    if (req.method === 'GET') {

        const id = req.query.id as string;

        try {
            const result = await Project.findAll({
                include: [
                    {
                        model: ProjectPartner, as: 'ProjectPartners', required: false,
                        where: {
                            idUsers: { [Op.ne]: Number(id) }
                        }
                    }
                ]
            })

            return res.status(200).json({ success: true, data: result })
        } catch (error) {
            return res.status(500).json({ success: false, message: (error as Error).message })

        }
    } else {
        res.status(405).json({ success: false, message: 'Method not allowed' })
    }
}
