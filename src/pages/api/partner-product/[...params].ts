import { NextApiRequest, NextApiResponse } from 'next'
import { db } from '@/config/db';
import { Product, ProductCategory, ProductImage, ProductPacking, ProductPartner, User } from '@/models/__associations';
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
    const [idUsers, idProducts] = req.query.params as string[];

    console.log('Query Parameters:', req.query);

    const userData = await User.findOne({
        where: { idUsers: idUsers }
    });
    if (!userData) {
        res.status(404).json({ success: false, message: 'User not found' });
        return;
    }

    const productDetails = await Product.findOne({
        include: [ProductImage, ProductCategory, {
            model: ProductPartner,
            include: [ProductPacking],
            where: { idUsers: idUsers }
        }],
        where: { idProducts: idProducts }
    });

    if (!productDetails) {
        res.status(404).json({ success: false, message: 'Product not found' });
        return;
    }

    const partners = (productDetails as any)?.ProductPartners || (productDetails as any)?.ProductPartner || [];
    if (Array.isArray(partners)) {
        partners.sort((a: any, b: any) => {
            const sizeA = Number(a?.ProductPacking?.size) || Infinity;
            const sizeB = Number(b?.ProductPacking?.size) || Infinity;
            return sizeA - sizeB; // Small size first
        });
    }


    res.status(200).send({ product: productDetails, user: userData });
}

export default cors(handler as any);