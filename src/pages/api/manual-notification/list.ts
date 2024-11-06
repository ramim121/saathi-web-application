import { NextApiRequest, NextApiResponse } from 'next'
import { User, ManualNotification } from '@/models/__associations'
import { Op, fn, col } from 'sequelize'

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
): Promise<void> {
    if (req.method === 'GET') {
        const { idManualNotifications, sendViaSms, sendViaEmail, sendViaPush, sendOn, createdBy, orderBy, orderType, page, pageSize } = req.query

        let whereClause: { idManualNotifications?: { [Op.like]: string }; sendViaSms?: { [Op.like]: string }; sendViaEmail?: { [Op.like]: string }; sendViaPush?: { [Op.like]: string }; sendOn?: { [Op.like]: string }; } = {};
        let createByClause: { fullName?: { [Op.like]: string } } = {};

        if (idManualNotifications) {
            whereClause = { ...whereClause, idManualNotifications: { [Op.like]: `%${idManualNotifications}%` } };
        }

        if (sendViaSms) {
            whereClause = { ...whereClause, sendViaSms: { [Op.like]: `%${sendViaSms}%` } };
        }

        if (sendViaEmail) {
            whereClause = { ...whereClause, sendViaEmail: { [Op.like]: `%${sendViaEmail}%` } };
        }

        if (sendViaPush) {
            whereClause = { ...whereClause, sendViaPush: { [Op.like]: `%${sendViaPush}%` } };
        }

        if (sendOn) {
            whereClause = { ...whereClause, sendOn: { [Op.like]: `%${sendOn}%` } };
        }

        if (createdBy) {
            createByClause = { fullName: { [Op.like]: `%${createdBy}%` } }
        }



        const limit = pageSize ? parseInt(pageSize as string) : 10;
        const offset = page ? (parseInt(page as string) - 1) * limit : 0;
        try {
            const result = await ManualNotification.findAndCountAll({
                attributes: [
                    'idManualNotifications',
                    'sendViaSms',
                    'sendViaEmail',
                    'sendViaPush',
                    'sendOn',
                    'createdBy',
                    [fn('DATE_FORMAT', col('send_on'), '%Y-%m-%d %H:%i:%s'), 'formattedSendOn'],
                ],
                include: [{
                    model: User,
                    attributes: ['fullName'],
                    where: createByClause
                }],
                where: whereClause,
                limit,
                offset,
                distinct: true,
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
