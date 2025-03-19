import { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/config/db';
import Cors from 'micro-cors';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '@/config/constants';
import JWTPayload from '@/types/JWTPayload';

const cors = Cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS', 'PUT'],
    allowHeaders: ['X-Requested-With', 'Authorization', 'Content-Type'],
});


export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    if (req.method === 'GET') {
        let tokenData = req.headers.authorization;
        let token = tokenData?.split(' ')[1];

        if (!token || jwt.verify(token, JWT_SECRET) === null) { res.status(401).json({ success: false, message: 'Invalid token' }); return; }

        let userInfo = jwt.decode(token) as JWTPayload;
        if (userInfo.userType !== 'admin') { res.status(403).json({ success: false, message: 'Access denied' }); return; }
        try {
            const { idProductOrders,
                orderId,
                buyer,
                area,
                orderAmount,
                orderDate,
                status,
                orderBy,
                orderType,
                page,
                pageSize } = req.query;

            const limit = pageSize ? parseInt(pageSize as string) : 10;
            const offset = page ? (parseInt(page as string) - 1) * limit : 0;
            const totalCountQuery = db('product_orders')
                .count('* as total');

            const totalCountResult = await totalCountQuery;
            const totalCount = totalCountResult[0].total;

            let orderListQuery = db('product_orders')
                .select('users.full_name as buyerName', 'users.id_users', 'users.email as buyerEmail', 'users.phone_number as buyerPhoneNumber')
                .select('districts.name as districtName', 'districts.id_districts')
                .select('police_stations.name as policeStationName', 'police_stations.id_police_stations')
                .select('product_orders.*')
                .select(db.raw('DATE_FORMAT(product_orders.created_at, "%Y-%m-%d") as orderDate'))
                .leftJoin('users', 'product_orders.ordered_by', 'users.id_users')
                .leftJoin('user_addresses', 'product_orders.id_user_addresses', 'user_addresses.id_user_addresses')
                .leftJoin('districts', 'user_addresses.id_districts', 'districts.id_districts')
                .leftJoin('police_stations', 'user_addresses.id_police_stations', 'police_stations.id_police_stations')
                .limit(limit)
                .offset(offset)
                .orderBy('product_orders.created_at', 'desc');

            if (idProductOrders) {
                orderListQuery = orderListQuery.where('product_orders.id_product_orders', 'like', `%${idProductOrders}%`);
            }
            if (orderId) {
                orderListQuery = orderListQuery.where('product_orders.order_id', 'like', `%${orderId}%`);
            }
            if (buyer) {
                orderListQuery = orderListQuery.where('users.full_name', 'like', `%${buyer}%`).orWhere('users.phone_number', 'like', `%${buyer}%`).orWhere('users.email', 'like', `%${buyer}%`);
            }
            if (area) {
                orderListQuery = orderListQuery.where('districts.name', 'like', `%${area}%`).orWhere('police_stations.name', 'like', `%${area}%`);
            }
            if (orderAmount) {
                orderListQuery = orderListQuery.where('product_orders.order_amount', 'like', `%${orderAmount}%`);
            }
            if (orderDate) {
                orderListQuery = orderListQuery.whereRaw('DATE(product_orders.created_at) = ?', [orderDate]);
            }
            if (status) {
                orderListQuery = orderListQuery.where('product_orders.order_status', 'like', `%${status}%`);
            }
            if (orderBy && orderType) {
                orderListQuery = orderListQuery.orderBy(orderBy as string, orderType as 'asc' | 'desc');
            } else {
                orderListQuery = orderListQuery.orderBy('product_orders.created_at', 'desc');
            }

            const orderList = await orderListQuery;
            return res.status(200).json({
                success: true,
                data: orderList,
                total: totalCount,
                currentPage: page ? parseInt(page as string) : 1,
                totalPages: Math.ceil(Number(totalCount) / limit)
            });
        } catch (error) {
            return res.status(400).json({ success: false, message: (error as Error).message })
        }
    } else {
        res.status(405).json({ success: false, message: 'Method not allowed' })
    }
}