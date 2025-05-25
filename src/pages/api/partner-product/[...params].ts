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

    const userData = await User.findOne({
        where: { idUsers: idUsers }
    });
    if (!userData) {
        res.status(404).json({ success: false, message: 'User not found' });
        return;
    }

    const productDetails = await Product.findAll({
        include: [ProductImage, ProductCategory, {
            model: ProductPartner,
            include: [ProductPacking],
            where: { idUsers: idUsers }
        }],
        where: { idProducts: idProducts },
        order: [[ProductPartner, ProductPacking, 'size', 'ASC']]
    });

    if (!productDetails) {
        res.status(404).json({ success: false, message: 'Product not found' });
        return;
    }


    res.status(200).send({ product: productDetails, user: userData });
}

export default cors(handler as any);