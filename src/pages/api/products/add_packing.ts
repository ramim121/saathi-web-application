import { NextApiRequest, NextApiResponse } from 'next';
import { ProductPacking } from '@/models/__associations';
import Joi from 'joi';
import sequelize from '@/config/db';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '@/config/constants';
import JWTPayload from '@/types/JWTPayload';


const schema = Joi.object({
    packingName: Joi.string().required().messages({
        "any.required": "Packing name is required",
        "string.base": "Packing name must be a string",
        "string.empty": "Packing name is required",
    }),
    idProducts: Joi.number().greater(0).required().messages({
        "any.required": "Product is required",
        "number.base": "Product is required",
        "number.greater": "Product must be greater than 0",
    }),
}).unknown();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'POST') {
        let tokenData = req.headers.authorization;
        let token = tokenData?.split(' ')[1];

        if (!token || jwt.verify(token, JWT_SECRET) === null) { res.status(401).json({ success: false, message: 'Invalid token' }); return; }

        let userInfo = jwt.decode(token) as JWTPayload;
        if (userInfo.userType !== 'admin') { res.status(403).json({ success: false, message: 'Access denied' }); return; }

        const { packingName, size, idProducts } = req.body
        const options = {
            abortEarly: false,
        };

        const { error } = schema.validate({ packingName, idProducts }, options);

        if (error) {
            let errorMessage: string[] = [];

            error.details.forEach((e) => {
                errorMessage.push(e.message);
            });
            return res.status(400).json({ success: false, message: errorMessage.join(". <br>") });
        }

        const product = await ProductPacking.findOne({ where: { packingName, idProducts } });

        if (product) {
            return res.status(400).json({ success: false, message: 'Product packing already exists' });
        }

        const transaction = await sequelize.transaction();

        try {
            await ProductPacking.create({ packingName, size, idProducts }, { transaction });
            await transaction.commit();
            return res.status(200).json({ success: true, message: 'Product packing created successfully' })
        } catch (err) {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: (err as Error).message })
        }
    } else {
        res.status(405).json({ success: false, message: 'Method not allowed' })
    }
}