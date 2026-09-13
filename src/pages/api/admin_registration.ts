import { NextApiRequest, NextApiResponse } from 'next';
import { User } from '@/models/__associations';
import Joi from 'joi';
import sequelize from '@/config/db';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '@/config/constants';
import JWTPayload from '@/types/JWTPayload';

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
    phoneNumber: Joi.string().pattern(/^01\d{9}$/).required().messages({
        "any.required": "Phone number is required",
        "string.empty": "Phone number can not be empty",
        "string.pattern.base": "Phone number must be 11 digits and start with 01",
    }),
}).unknown();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'POST') {
        let tokenData = req.headers.authorization;
        let token = tokenData?.split(' ')[1];

        if (!token || jwt.verify(token, JWT_SECRET) === null) { res.status(401).json({ success: false, message: 'Invalid token' }); return; }

        let userInfo = jwt.decode(token) as JWTPayload;
        if (userInfo.userType !== 'admin') { res.status(403).json({ success: false, message: 'Access denied' }); return; }

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
        const transaction = await sequelize.transaction();
        try {
            const admin = await User.create({
                fullName: name,
                email,
                phoneNumber,
                userType: 'admin'
            }, { transaction });
            await transaction.commit();
            return res.status(200).json({ success: true, message: 'Admin registered successfully', data: admin })
        } catch (err) {
            return res.status(400).json({ success: false, message: (err as Error).message })
        }
    } else {
        res.status(405).json({ success: false, message: 'Method not allowed' })
    }
}