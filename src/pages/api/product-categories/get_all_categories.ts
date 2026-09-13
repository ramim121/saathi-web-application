import { NextApiRequest, NextApiResponse } from 'next'
import { ProductCategory } from '@/models/__associations'

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
): Promise<void> {
    if (req.method === 'GET') {
        try {
            const result = await ProductCategory.findAll({
                where: { status: 'active' },
                attributes: ['idProductCategories', 'productCategoryName', 'productCategoryId'],
            });

            return res.status(200).json({ success: true, data: result });
        } catch (error) {
            return res.status(400).json({ success: false, message: (error as Error).message });
        }
    } else {
        res.status(405).json({ success: false, message: 'Method not allowed' });
    }
}
