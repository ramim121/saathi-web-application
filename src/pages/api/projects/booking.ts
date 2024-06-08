import { NextApiRequest, NextApiResponse } from 'next';
import { ProjectInvestor } from '@/models/__associations';
import Joi from 'joi';

const schema = Joi.object({
    idProjects: Joi.number().required().messages({
        "any.required": "Project must be selected",
        "number.base": "Project must be selected",
    }),
    idUsers: Joi.number().required().messages({
        "any.required": "Investor must be selected",
        "number.base": "Investor must be selected",
    }),
    unitPurchased: Joi.number().required().messages({
        "any.required": "Unit purchased is required",
        "number.base": "Unit purchased can not be empty",
    }),
    amountInvested: Joi.number().min(0).required().messages({
        "any.required": "Amount invested is required",
        "number.base": "Amount invested can not be empty",
        "number.min": "Amount invested can not be less than 0",
    }),
    investmentDate: Joi.date().required().messages({
        "any.required": "Investment date is required",
        "date.base": "Invalid date",
    }),
}).unknown();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'POST') {
        const { idProjects, idUsers, unitPurchased, amountInvested, investmentDate } = req.body
        const options = {
            abortEarly: false,
        };
        const { error } = schema.validate({ idProjects, idUsers, unitPurchased, amountInvested, investmentDate }, options);
        if (error) {
            let errorMessage: string[] = [];

            error.details.forEach((e) => {
                errorMessage.push(e.message);
            });
            return res.status(400).json({ success: false, message: errorMessage.join(". <br>") });
        }
        try {
            const booking = await ProjectInvestor.create({
                idProjects,
                idUsers,
                unitPurchased,
                amountInvested,
                investmentDate,
                investmentStatus: 'booked'
            })

            return res.status(200).json({ booking })
        } catch (err) {
            return res.status(500).json({ message: (err as Error).message })
        }
    } else {
        res.status(405).json({ message: 'Method not allowed' })
    }
}