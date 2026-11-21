import { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/config/db';
import Cors from 'micro-cors';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '@/config/constants';
import JWTPayload from '@/types/JWTPayload';
import { likePattern, numberIn, searchTerm } from '@/utils/listSearch';

const cors = Cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS', 'PUT'],
    allowHeaders: ['X-Requested-With', 'Authorization', 'Content-Type'],
});


/** Columns the orders table can sort by, by the names the admin page sends. */
const ORDER_COLUMNS: Record<string, string> = {
    createdAt: 'product_orders.created_at',
    idProductOrders: 'product_orders.id_product_orders',
    orderId: 'product_orders.order_id',
    orderAmount: 'product_orders.order_amount',
    status: 'product_orders.order_status',
    buyerName: 'users.full_name',
};

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    if (req.method === 'GET') {
        let tokenData = req.headers.authorization;
        let token = tokenData?.split(' ')[1];

        if (!token || jwt.verify(token, JWT_SECRET) === null) { res.status(401).json({ success: false, message: 'Invalid token' }); return; }

        let userInfo = jwt.decode(token) as JWTPayload;
        if (userInfo.userType !== 'admin') { res.status(403).json({ success: false, message: 'Access denied' }); return; }
        try {
            const { idProductOrders, orderId, buyer, area, orderAmount, orderDate, status, orderBy, orderType, page, pageSize } = req.query;
            const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

            const limit = Math.min(Math.max(parseInt(pageSize as string) || 10, 1), 100);
            const current = Math.max(parseInt(page as string) || 1, 1);
            const offset = (current - 1) * limit;
            const term = searchTerm(req.query.q);

            // Joins and filters, shared by the count and the page: the total is
            // the number of matching orders (it used to count every order,
            // whatever the filters), and each OR group is bracketed, so "buyer"
            // or "area" no longer cancels the other filters.
            const matching = () => {
                const q = db('product_orders')
                    .leftJoin('users', 'product_orders.ordered_by', 'users.id_users')
                    .leftJoin('user_addresses', 'product_orders.id_user_addresses', 'user_addresses.id_user_addresses')
                    .leftJoin('districts', 'user_addresses.id_districts', 'districts.id_districts')
                    .leftJoin('police_stations', 'user_addresses.id_police_stations', 'police_stations.id_police_stations');
                if (text(idProductOrders)) q.where('product_orders.id_product_orders', 'like', likePattern(text(idProductOrders)));
                if (text(orderId)) q.where('product_orders.order_id', 'like', likePattern(text(orderId)));
                if (text(buyer)) {
                    const p = likePattern(text(buyer));
                    q.where((w) => {
                        w.where('users.full_name', 'like', p).orWhere('users.phone_number', 'like', p).orWhere('users.email', 'like', p);
                    });
                }
                if (text(area)) {
                    const p = likePattern(text(area));
                    q.where((w) => {
                        w.where('districts.name', 'like', p).orWhere('police_stations.name', 'like', p);
                    });
                }
                if (text(orderAmount)) q.where('product_orders.order_amount', 'like', likePattern(text(orderAmount)));
                // "2026-11" or "2026-11-05": the order date starts with it.
                if (text(orderDate)) q.whereRaw("DATE_FORMAT(product_orders.created_at, '%Y-%m-%d') LIKE ?", [`${text(orderDate).replace(/[\\%_]/g, (c) => `\\${c}`)}%`]);
                if (text(status)) q.where('product_orders.order_status', text(status));
                // One box: the order ID, the buyer's name, phone or email, or the order number.
                if (term) {
                    const p = likePattern(term.replace(/^#/, ''));
                    const n = numberIn(term);
                    q.where((w) => {
                        w.where('product_orders.order_id', 'like', p).orWhere('users.full_name', 'like', p).orWhere('users.phone_number', 'like', p).orWhere('users.email', 'like', p);
                        if (n) w.orWhere('product_orders.id_product_orders', n);
                    });
                }
                return q;
            };

            const counted: any = await matching().countDistinct({ total: 'product_orders.id_product_orders' }).first();
            const totalCount = Number(counted?.total) || 0;

            const column = (typeof orderBy === 'string' && ORDER_COLUMNS[orderBy]) || ORDER_COLUMNS.createdAt;
            const direction = String(orderType).toLowerCase() === 'asc' ? 'asc' : 'desc';
            const orderList = await matching()
                .select('users.full_name as buyerName', 'users.id_users', 'users.email as buyerEmail', 'users.phone_number as buyerPhoneNumber')
                .select('districts.name as districtName', 'districts.id_districts')
                .select('police_stations.name as policeStationName', 'police_stations.id_police_stations')
                .select('product_orders.*')
                .select(db.raw('DATE_FORMAT(product_orders.created_at, "%Y-%m-%d") as orderDate'))
                .orderBy(column, direction)
                .orderBy('product_orders.id_product_orders', 'desc')
                .limit(limit)
                .offset(offset);

            return res.status(200).json({
                success: true,
                data: orderList,
                total: totalCount,
                currentPage: current,
                totalPages: Math.ceil(totalCount / limit)
            });
        } catch (error) {
            return res.status(400).json({ success: false, message: (error as Error).message })
        }
    } else {
        res.status(405).json({ success: false, message: 'Method not allowed' })
    }
}