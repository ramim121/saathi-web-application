import { NextApiRequest, NextApiResponse } from 'next';
import { Product } from '@/models/__associations';
import Joi from 'joi';
import sequelize from '@/config/db';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '@/config/constants';
import JWTPayload from '@/types/JWTPayload';


const schema = Joi.object({
    productName: Joi.string().required().messages({
        "any.required": "Product name is required",
        "string.empty": "Product name can not be empty",
    }),
    idProductCategories: Joi.number().required().messages({
        "any.required": "Product category is required",
        "number.base": "Product category must be selected",
    }),
    idUnit: Joi.number().required().messages({
        "any.required": "Unit is required",
        "number.base": "Unit must be selected",
    }),
}).unknown();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'POST') {
        let tokenData = req.headers.authorization;
        let token = tokenData?.split(' ')[1];

        if (!token || jwt.verify(token, JWT_SECRET) === null) { res.status(401).json({ success: false, message: 'Invalid token' }); return; }

        let userInfo = jwt.decode(token) as JWTPayload;
        if (userInfo.userType !== 'admin') { res.status(403).json({ success: false, message: 'Access denied' }); return; }

        const { productName, idProductCategories, idUnit, productDescription } = req.body
        const options = {
            abortEarly: false,
        };

        const { error } = schema.validate({ productName, idProductCategories, idUnit, productDescription }, options);

        if (error) {
            let errorMessage: string[] = [];

            error.details.forEach((e) => {
                errorMessage.push(e.message);
            });
            return res.status(400).json({ success: false, message: errorMessage.join(". <br>") });
        }

        const productNameExists = await Product.findOne({ where: { productName } });

        if (productNameExists) {
            return res.status(400).json({ success: false, message: 'Product name already exists' })
        }

        const transaction = await sequelize.transaction();

        try {
            const product = await Product.create({
                productName,
                idProductCategories,
                idUnit,
                productDescription
            }, { transaction })
            await transaction.commit();

            return res.status(200).json({ success: true, message: 'Product created successfully', data: product })
        } catch (err) {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: (err as Error).message })
        }
    } else {
        res.status(405).json({ success: false, message: 'Method not allowed' })
    }
}