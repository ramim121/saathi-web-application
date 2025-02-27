import { NextApiRequest, NextApiResponse } from 'next'
import { Product, ProductCategory, Unit } from '@/models/__associations'
import { Op } from 'sequelize'
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '@/config/constants';
import JWTPayload from '@/types/JWTPayload';

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

        const { idProducts, productName, productCategory, unit, productDescription, orderBy, orderType, page, pageSize } = req.query;

        let whereClause: { idProducts?: { [key: string]: any }; productName?: { [key: string]: any }; productDescription?: { [key: string]: any } } = {};

        if (idProducts) {
            whereClause = { ...whereClause, idProducts: { [Op.like]: `%${idProducts}%` } };
        }

        if (productName) {
            whereClause = { ...whereClause, productName: { [Op.like]: `%${productName}%` } };
        }

        if (productDescription) {
            whereClause = { ...whereClause, productDescription: { [Op.like]: `%${productDescription}%` } };
        }

        const limit = pageSize ? parseInt(pageSize as string) : 10;
        const offset = page ? (parseInt(page as string) - 1) * limit : 0;

        try {
            const result = await Product.findAndCountAll({
                where: whereClause,
                include: [
                    {
                        model: ProductCategory,
                        where: productCategory ? { productCategoryName: { [Op.like]: `%${productCategory}%` } } : {}
                    },
                    {
                        model: Unit,
                        where: unit ? { unitName: { [Op.like]: `%${unit}%` } } : {}
                    }
                ],
                limit,
                offset,
                order: [[orderBy as string, orderType === 'DESC' ? 'DESC' : 'ASC']],
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