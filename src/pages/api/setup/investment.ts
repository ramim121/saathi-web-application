import { NextApiRequest, NextApiResponse } from 'next';
import { InvestmentSetup } from '@/models/__associations';
import Joi from 'joi';

const schema = Joi.object({
    nameOfThePlan: Joi.string().required().messages({
        "any.required": "Name of the plan is required",
        "string.empty": "Name of the plan can not be empty",
    }),
    investmentType: Joi.string().valid('high_return', 'low_return', 'short_duration', 'long_duration', 'shariah').required().empty().messages({
        "any.required": "Investment type is required",
        "any.only": "Invalid investment type",
        "string.empty": "Investment type can not be empty",
    }),
    returnType: Joi.string().valid('variable', 'fixed').required().messages({
        "any.required": "Return type is required",
        "any.only": "Invalid return type",
    }),
    minimumReturn: Joi.number().min(0.00001).required().messages({
        "any.required": "Minimum return is required",
        "number.base": "Minimum return must be a number",
        "number.min": "Minimum return must be greater than 0",
    }),
    maximumReturn: Joi.number().min(Joi.ref('minimumReturn')).required().messages({
        "any.required": "Maximum return is required",
        "number.base": "Maximum return must be a number",
        "number.min": "Maximum return must be greater than or equal to minimum return",
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
        try {
            const investment = await InvestmentSetup.create({
                planName: nameOfThePlan,
                investmentType,
                returnType,
                minimumReturn,
                maximumReturn,
                duration,
                tenure
            })
            return res.status(200).json({ investment })
        } catch (err) {
            return res.status(500).json({ message: (err as Error).message })
        }
    } else {
        res.status(405).json({ message: 'Method not allowed' })
    }
}