import { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/config/db';
import Cors from 'micro-cors';

const cors = Cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS', 'PUT'],
    allowHeaders: ['X-Requested-With', 'Authorization', 'Content-Type'],
});

async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const { limit, offset, idProductCategories, productName, idUsers } = req.query;
    let productsForMartQuery = db('product_partners')
        .select('users.full_name', 'users.id_users')
        .select('product_categories.product_category_name', 'product_categories.id_product_categories', 'product_categories.category_image')
        .select('products.product_name','products.id_products')
        .select('product_partners.sell_rate','product_partners.id_product_partners')
        .select('product_packings.packing_name')
        .select('product_images.image_name', 'product_images.thumbnail')
        .leftJoin('products', 'product_partners.id_products', 'products.id_products')
        .leftJoin('product_categories', 'products.id_product_categories', 'product_categories.id_product_categories')
        .leftJoin('unit', 'products.id_unit', 'unit.id_unit')
        .leftJoin('users', 'product_partners.id_users', 'users.id_users')
        .leftJoin('product_packings', 'product_partners.id_product_packings', 'product_packings.id_product_packings')
        .leftJoin('product_images', function () {
            this.on('products.id_products', '=', 'product_images.id_products')
                .andOn('product_images.default', '=', db.raw('?', ['yes']))
        })
        .limit(parseInt(limit?.toString() || '10'))
        .offset(parseInt(offset?.toString() || '0'))
        .groupBy(['product_partners.id_users', 'product_partners.id_products'])
        .debug(true);


    if (idProductCategories) {
        productsForMartQuery = productsForMartQuery.where('products.id_product_categories', idProductCategories);
    }

    if (productName) {
        productsForMartQuery = productsForMartQuery.where('products.product_name', 'like', `%${productName}%`);
    }

    if (idUsers) {
        productsForMartQuery = productsForMartQuery.where('product_partners.id_users', idUsers);
    }

    const productsForMart = await productsForMartQuery;

    res.status(200).json(productsForMart);
}

export default cors(handler as any);