import { NextApiRequest, NextApiResponse } from 'next';
import { ProductPartner } from '@/models/__associations';
import Joi from 'joi';
import sequelize from '@/config/db';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '@/config/constants';
import JWTPayload from '@/types/JWTPayload';


const schema = Joi.object({
    idProducts: Joi.number().greater(0).required().messages({
        "any.required": "Product is required",
        "number.base": "Product is required",
        "number.greater": "Product must be greater than 0",
    }),
    sellRate: Joi.number().greater(0).required().messages({
        "any.required": "Sell rate is required",
        "number.base": "Sell rate must be a number",
        "number.greater": "Sell rate must be greater than 0",
    }),
    partners: Joi.array().items(Joi.object({
        idUsers: Joi.number().greater(0).required().messages({
            "any.required": "Partner is required",
            "number.base": "Partner is required",
            "number.greater": "Partner must be selected",
        }),
    }).unknown()).min(1).required().messages({
        "any.required": "Partner is required",
        "array.min": "Partner is required",
    }),
}).unknown();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'POST') {
        let tokenData = req.headers.authorization;
        let token = tokenData?.split(' ')[1];

        if (!token || jwt.verify(token, JWT_SECRET) === null) { res.status(401).json({ success: false, message: 'Invalid token' }); return; }

        let userInfo = jwt.decode(token) as JWTPayload;
        if (userInfo.userType !== 'admin') { res.status(403).json({ success: false, message: 'Access denied' }); return; }

        const { idProducts, sellRate, partners } = req.body
        const options = {
            abortEarly: false,
        };

        const { error } = schema.validate({ idProducts, sellRate, partners }, options);

        if (error) {
            let errorMessage: string[] = [];

            error.details.forEach((e) => {
                errorMessage.push(e.message);
            });
            return res.status(400).json({ success: false, message: errorMessage.join(". <br>") });
        }

        const transaction = await sequelize.transaction();

        try {
            for (let i = 0; i < partners.length; i++) {
                await ProductPartner.create({
                    idProducts,
                    idUsers: partners[i].idUsers,
                    sellRate
                }, { transaction });
            }
            await transaction.commit();
            return res.status(200).json({ success: true, message: 'Product partner assigned successfully' })
        } catch (err) {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: (err as Error).message })
        }
    } else {
        res.status(405).json({ success: false, message: 'Method not allowed' })
    }
}