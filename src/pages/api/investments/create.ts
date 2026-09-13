import { NextApiRequest, NextApiResponse } from 'next';
import { InvestmentSetup } from '@/models/__associations';
import Joi from 'joi';
import sequelize from '@/config/db';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '@/config/constants';
import JWTPayload from '@/types/JWTPayload';
const schema = Joi.object({
    nameOfThePlan: Joi.string().required().messages({
        "any.required": "Name of the plan is required",
        "string.empty": "Name of the plan can not be empty",
    }),
    investmentType: Joi.string().valid('sustainable_return', 'fast_return').required().empty().messages({
        "any.required": "Investment type is required",
        "any.only": "Invalid investment type",
        "string.empty": "Investment type can not be empty",
    }),
    returnType: Joi.string().valid('variable', 'fixed').required().messages({
        "any.required": "Return type is required",
        "any.only": "Invalid return type",
    }),
    minimumReturn: Joi.number().required().messages({
        "any.required": "Minimum return is required",
        "number.base": "Minimum return must be a number",
    }),
    maximumReturn: Joi.number().required().messages({
        "any.required": "Maximum return is required",
        "number.base": "Maximum return must be a number",
    }),
    duration: Joi.number().min(1).required().messages({
        "any.required": "Tenure is required",
        "number.base": "Tenure must be a number",
        "number.min": "Tenure must be greater than 0",
    }),
    tenure: Joi.string().valid('months', 'years').required().messages({
        "any.required": "Tenure is required",
        "any.only": "Invalid tenure",
    }),
}).unknown();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'POST') {
        let tokenData = req.headers.authorization;
        let token = tokenData?.split(' ')[1];

        if (!token || jwt.verify(token, JWT_SECRET) === null) { res.status(401).json({ success: false, message: 'Invalid token' }); return; }

        let userInfo = jwt.decode(token) as JWTPayload;
        if (userInfo.userType !== 'admin') { res.status(403).json({ success: false, message: 'Access denied' }); return; }

        const { nameOfThePlan, investmentType, returnType, minimumReturn, maximumReturn, duration, tenure } = req.body
        const options = {
            abortEarly: false,
        };

        const { error } = schema.validate({ nameOfThePlan, investmentType, returnType, minimumReturn, maximumReturn, duration, tenure }, options);

        if (error) {
            let errorMessage: string[] = [];

            error.details.forEach((e) => {
                errorMessage.push(e.message);
            });
            return res.status(400).json({ success: false, message: errorMessage.join(". <br>") });
        }

        const investmentExists = await InvestmentSetup.findOne({ where: { planName: nameOfThePlan } });

        if (investmentExists) {
            return res.status(400).json({ success: false, message: 'Investment plan already exists' })
        }

        const transaction = await sequelize.transaction();
        try {
            const investment = await InvestmentSetup.create({
                planName: nameOfThePlan,
                investmentType,
                returnType,
                minimumReturn,
                maximumReturn,
                duration,
                tenure
            }, { transaction });
            await transaction.commit();
            return res.status(200).json({ success: true, message: 'Investment plan created successfully', data: investment })
        } catch (err) {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: (err as Error).message })
        }
    } else {
        res.status(405).json({ success: false, message: 'Method not allowed' })
    }
}