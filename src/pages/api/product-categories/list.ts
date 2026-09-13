import { NextApiRequest, NextApiResponse } from 'next'
import { ProductCategory } from '@/models/__associations'
import { Op } from 'sequelize'
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '@/config/constants';
import JWTPayload from '@/types/JWTPayload';
import { safeOrder } from '@/utils/order';

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
): Promise<void> {
    if (req.method === 'GET') {
        let tokenData = req.headers.authorization;
        let token = tokenData?.split(' ')[1];

        if (!token || jwt.verify(token, JWT_SECRET) === null) { res.status(401).json({ success: false, message: 'Invalid token' }); return; }

        let userInfo = jwt.decode(token) as JWTPayload;
        if (userInfo.userType !== 'admin') { res.status(403).json({ success: false, message: 'Access denied' }); return; }

        const { idProductCategories, productCategoryName, productCategoryId, status, orderBy, orderType, page, pageSize } = req.query;

        let whereClause: { idProductCategories?: { [key: string]: any }; productCategoryName?: { [key: string]: any }; productCategoryId?: { [key: string]: any }; status?: { [key: string]: any } } = {};

        if (idProductCategories) {
            whereClause = { ...whereClause, idProductCategories: { [Op.like]: `%${idProductCategories}%` } };
        }

        if (productCategoryName) {
            whereClause = { ...whereClause, productCategoryName: { [Op.like]: `%${productCategoryName}%` } };
        }

        if (productCategoryId) {
            whereClause = { ...whereClause, productCategoryId: { [Op.like]: `%${productCategoryId}%` } };
        }

        if (status) {
            whereClause = { ...whereClause, status: { [Op.like]: `%${status}%` } };
        }

        const limit = pageSize ? parseInt(pageSize as string) : 10;
        const offset = page ? (parseInt(page as string) - 1) * limit : 0;

        try {
            const result = await ProductCategory.findAndCountAll({
                where: whereClause,
                limit,
                offset,
                order: safeOrder(ProductCategory, orderBy, orderType, 'idProductCategories', 'ASC'),
            })

            return res.status(200).json({
                success: true,
                data: result.rows,
                total: result.count,
                currentPage: page ? parseInt(page as string) : 1,
                totalPages: Math.ceil(result.count / limit)
            })
        } catch (error) {
            return res.status(400).json({ success: false, message: (error as Error).message })
        }
    } else {
        res.status(405).json({ success: false, message: 'Method not allowed' })
    }
}
