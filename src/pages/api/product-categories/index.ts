import { NextApiRequest, NextApiResponse } from 'next'
import Cors from 'micro-cors';
import ProductCategory from '@/models/ProductCategory';

const cors = Cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS', 'PUT'],
    allowHeaders: ['X-Requested-With', 'Authorization', 'Content-Type'],
});

async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    res.status(200).send(await ProductCategory.findAll());
}

export default cors(handler as any);