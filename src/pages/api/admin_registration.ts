import { NextApiRequest, NextApiResponse } from 'next';
import { User } from '@/models/__associations';
import Joi from 'joi';

const schema = Joi.object({
    name: Joi.string().required().messages({
        "any.required": "Name is required",
        "string.empty": "Name can not be empty",
    }),
    email: Joi.string().email().required().messages({
        "any.required": "Email is required",
        "string.empty": "Email can not be empty",
        "string.email": "Invalid email",
    }),
    phoneNumber: Joi.number().required().messages({
        "any.required": "Phone number is required",
        "number.base": "Phone number can not be empty",
    }),
}).unknown();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'POST') {
        const { name, email, phoneNumber } = req.body
        const options = {
            abortEarly: false,
        };
        const { error } = schema.validate({ name, email, phoneNumber }, options);
        if (error) {
            let errorMessage: string[] = [];

            error.details.forEach((e) => {
                errorMessage.push(e.message);
            });
            return res.status(400).json({ success: false, message: errorMessage.join(". <br>") });
        }
        try {
            const admin = await User.create({
                fullName: name,
                email,
                phoneNumber,
                userType: 'admin'
            })

            return res.status(200).json({ admin })
        } catch (err) {
            return res.status(500).json({ message: (err as Error).message })
        }
    } else {
        res.status(405).json({ message: 'Method not allowed' })
    }
}