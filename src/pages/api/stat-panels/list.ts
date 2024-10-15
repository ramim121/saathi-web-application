import { NextApiRequest, NextApiResponse } from 'next'
import { AppStatPanel } from '@/models/__associations'
import { Op } from 'sequelize'


export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
): Promise<void> {
    if (req.method === 'GET') {
        const { idAppStatPanel, statLabel, statValue, statType, orderBy, orderType, page, pageSize } = req.query;

        let whereClause: { idAppStatPanel?: { [key: string]: any }; statLabel?: { [key: string]: any }; statValue?: { [key: string]: any }; statType?: { [key: string]: any } } = {};

        if (idAppStatPanel) {
            whereClause = { ...whereClause, idAppStatPanel: { [Op.like]: `%${idAppStatPanel}%` } };
        }

        if (statLabel) {
            whereClause = { ...whereClause, statLabel: { [Op.like]: `%${statLabel}%` } };
        }

        if (statValue) {
            whereClause = { ...whereClause, statValue: { [Op.like]: `%${statValue}%` } };
        }

        if (statType) {
            whereClause = { ...whereClause, statType: { [Op.like]: `%${statType}%` } };
        }

        const limit = pageSize ? parseInt(pageSize as string) : 10;
        const offset = page ? (parseInt(page as string) - 1) * limit : 0;

        try {
            const result = await AppStatPanel.findAndCountAll({
                where: whereClause,
                limit,
                offset,
                order: [[orderBy as string, orderType === 'DESC' ? 'DESC' : 'ASC']],
            })

            return res.status(200).json({
                success: true,
                data: result.rows,
                total: result.count,
                currentPage: page ? parseInt(page as string) : 1,
                totalPages: Math.ceil(result.count / limit)
            })
        } catch (error) {
            return res.status(500).json({ success: false, message: (error as Error).message })
        }
    } else {
        res.status(405).json({ success: false, message: 'Method not allowed' })
    }
}