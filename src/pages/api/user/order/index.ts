import { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import JWTPayload from '@/types/JWTPayload';
import { JWT_SECRET } from '@/config/constants';

import { User, UserAddress, Division, District, PoliceStation, Product, ProductPacking, ProductPartner } from '@/models/__associations';
import Joi from 'joi';
import Cors from 'micro-cors';
import to from 'await-to-js';
import ProductOrder from '@/models/ProductOrder';
import sequelize, { db } from '@/config/db';
import ProductOrderItem from '@/models/ProductOrderItem';
import ProductOrderStatus from '@/models/ProductOrderStatus';

const cors = Cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE'],
    allowHeaders: ['X-Requested-With', 'Authorization', 'Content-Type'],
});

const orderCreateSchema = Joi.object({
    idUserAddresses: Joi.number().required().messages({
        "any.required": "Address is required",
    }),
    orderAmount: Joi.number().required().messages({
        "any.required": "Order amount is required",
    }),
    specialInstructions: Joi.string().allow(null, ''),
    orderItems: Joi.array().min(1).items(Joi.object({
        idProducts: Joi.number().required().messages({
            "any.required": "Product is required",
        }),
        quantity: Joi.number().required().messages({
            "any.required": "Quantity is required",
        }),
        rate: Joi.number().required().messages({
            "any.required": "Rate is required",
        }),
        idProductPartners: Joi.number().required().messages({
            "any.required": "Product partner and packing is required",
        }),
    })).required().messages({
        "any.required": "Order items are required",
    }),
});

async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method == 'OPTIONS') { return res.status(200).end(); }
    if (req.method == 'POST') {

        let tokenData = req.headers.authorization;
        let token = tokenData?.split(' ')[1];

        if (!token) { res.status(401).json({ success: false, message: 'Token not found' }); return; }
        try { jwt.verify(token, JWT_SECRET) } catch (e: any) { res.status(401).json({ success: false, message: e.message }); return; }

        let userInfo = jwt.decode(token) as JWTPayload;
        const user = await User.findByPk(userInfo!.idUsers);

        if (!user) { res.status(404).json({ message: 'User not found' }); return; }

        const { error } = orderCreateSchema.validate(req.body);
        if (error) {
            let errorMessage: string[] = [];
            error.details.forEach((e) => {
                errorMessage.push(e.message);
            });
            return res.status(400).json({ success: false, message: errorMessage });
        }

        const transaction = await sequelize.transaction();

        let [err, order] = await to(ProductOrder.create({
            orderedBy: userInfo!.idUsers,
            orderAmount: req.body.orderAmount,
            orderStatus: 'placed',
            specialInstructions: req.body.specialInstructions,
            idUserAddresses: req.body.idUserAddresses,
            orderId: (new Date()).getFullYear() + (new Date()).getMonth() + (new Date()).getDate() + Math.floor(Math.random() * 1000000),
        }, { transaction }));
        if (err) {
            await transaction.rollback();
            return res.status(500).json({ success: false, message: err.message });
        }

        for (let i = 0; i < req.body.orderItems.length; i++) {

            let [err] = await to(ProductOrderItem.create({
                idProducts: req.body.orderItems[i].idProducts,
                idProductOrders: order!.idProductOrders,
                quantity: req.body.orderItems[i].quantity,
                rate: req.body.orderItems[i].rate,
                idProductPartners: req.body.orderItems[i].idProductPartners,
            }, { transaction }));

            if (err) {
                await transaction.rollback();
                return res.status(500).json({ success: false, message: err.message });
            }
        }

        [err] = await to(ProductOrderStatus.create({
            idProductOrders: order!.idProductOrders,
            statusName: 'placed',
            statusDescription: 'Order placed',
            idUsers: userInfo!.idUsers,
        }, { transaction }));
        if (err) {
            await transaction.rollback();
            return res.status(500).json({ success: false, message: err.message });
        }

        await transaction.commit();
        const orderData = await ProductOrder.findByPk(order!.idProductOrders!, { include: [{ model: UserAddress, include: [Division, District, PoliceStation] }] });
        const itemData = await db('product_order_items')
            .select('product_partners.id_product_partners', 'products.product_name', 'product_packings.packing_name', 'product_images.thumbnail', 'products.id_products')
            .select('product_categories.product_category_name', 'product_categories.category_image')
            .select('product_order_items.quantity', 'product_order_items.rate')
            .select('unit.unit_name')
            .select('users.id_users', 'users.full_name', 'users.profile_image')
            .leftJoin('products', 'product_order_items.id_products', 'products.id_products')
            .leftJoin('product_partners', 'product_order_items.id_product_partners', 'product_partners.id_product_partners')
            .leftJoin('product_packings', 'product_partners.id_product_packings', 'product_packings.id_product_packings')
            .leftJoin('product_categories', 'products.id_product_categories', 'product_categories.id_product_categories')
            .leftJoin('users', 'product_partners.id_users', 'users.id_users')
            .leftJoin('product_images', function () {
                this.on('products.id_products', '=', 'product_images.id_products')
                    .andOn('product_images.default', '=', db.raw('?', ['yes']))
            })
            .leftJoin('unit', 'products.id_unit', 'unit.id_unit')
            .where('product_order_items.id_product_orders', order!.idProductOrders);


        res.status(200).json({ success: true, message: 'Order placed successfully', order: orderData, items: itemData });
    }
    if (req.method == 'GET') {
        let tokenData = req.headers.authorization;
        let token = tokenData?.split(' ')[1];

        if (!token) { res.status(401).json({ success: false, message: 'Token not found' }); return; }
        try { jwt.verify(token, JWT_SECRET) } catch (e: any) { res.status(401).json({ success: false, message: e.message }); return; }

        let userInfo = jwt.decode(token) as JWTPayload;
        const user = await User.findByPk(userInfo!.idUsers);

        console.log(userInfo);

        if (!user) { res.status(404).json({ message: 'User not found' }); return; }

        const orderData = await ProductOrder.findAll(
            {
                include: [{
                    model: UserAddress, include: [Division, District, PoliceStation],
                }],
                where: { orderedBy: userInfo!.idUsers },
                order: [['createdAt', 'DESC']],
            });
        let orders = orderData.map((order) => order.toJSON());

        for (let i = 0; i < orders.length; i++) {
            const itemData = await db('product_order_items')
                .select('product_partners.id_product_partners', 'products.product_name', 'product_packings.packing_name', 'product_images.thumbnail', 'products.id_products')
                .select('product_categories.product_category_name', 'product_categories.category_image')
                .select('product_order_items.quantity', 'product_order_items.rate')
                .select('unit.unit_name')
                .select('users.id_users', 'users.full_name', 'users.profile_image')
                .leftJoin('products', 'product_order_items.id_products', 'products.id_products')
                .leftJoin('product_partners', 'product_order_items.id_product_partners', 'product_partners.id_product_partners')
                .leftJoin('product_packings', 'product_partners.id_product_packings', 'product_packings.id_product_packings')
                .leftJoin('product_categories', 'products.id_product_categories', 'product_categories.id_product_categories')
                .leftJoin('users', 'product_partners.id_users', 'users.id_users')
                .leftJoin('product_images', function () {
                    this.on('products.id_products', '=', 'product_images.id_products')
                        .andOn('product_images.default', '=', db.raw('?', ['yes']))
                })
                .leftJoin('unit', 'products.id_unit', 'unit.id_unit')
                .where('product_order_items.id_product_orders', orders[i].idProductOrders)

            orders[i].items = itemData;
        }

        res.status(200).json({ success: true, orders });
    }
}

export default cors(handler as any);