import { NextApiRequest, NextApiResponse } from 'next';
import { ProductOrder, ProductOrderStatus } from '@/models/__associations';
import sequelize from '@/config/db';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '@/config/constants';
import JWTPayload from '@/types/JWTPayload';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'POST') {
        let tokenData = req.headers.authorization;
        let token = tokenData?.split(' ')[1];

        if (!token || jwt.verify(token, JWT_SECRET) === null) { res.status(401).json({ success: false, message: 'Invalid token' }); return; }

        let userInfo = jwt.decode(token) as JWTPayload;
        if (userInfo.userType !== 'admin') { res.status(403).json({ success: false, message: 'Access denied' }); return; }

        const { idProductOrders, status } = req.body

        const transaction = await sequelize.transaction();
        try {

            const order = await ProductOrder.findByPk(idProductOrders);
            if (!order) {
                return res.status(404).json({ success: false, message: 'Order not found' });
            }
            order.orderStatus = status;
            await order.save({ transaction });

            const orderStatus = await ProductOrderStatus.create({
                idProductOrders: idProductOrders,
                idUsers: userInfo.idUsers,
                statusName: status,
                statusDescription: `Order ${status}`
            }, { transaction });
            if (!orderStatus) {
                await transaction.rollback();
                return res.status(500).json({ success: false, message: 'Failed to update order status' });
            }

            await transaction.commit();
            return res.status(200).json({ success: true, message: 'Order status changed successfully', data: order })
        } catch (error) {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: (error as Error).message })
        }
    } else {
        res.status(405).json({ success: false, message: 'Method not allowed' })
    }
}