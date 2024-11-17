import { NextApiRequest, NextApiResponse } from 'next';
import { Blog } from '@/models/__associations';
import Joi from 'joi';
import sequelize from '@/config/db';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '@/config/constants';
import JWTPayload from '@/types/JWTPayload';
const schema = Joi.object({
    heading: Joi.string().required().messages({
        "any.required": "Heading is required",
        "string.empty": "Heading can not be empty",
    }),
    description: Joi.string().required().messages({
        "any.required": "Description is required",
        "string.empty": "Description can not be empty",
    }),
    writtenBy: Joi.string().required().messages({
        "any.required": "Written by is required",
        "string.empty": "Written by can not be empty",
    }),
    writtenDate: Joi.date().required().messages({
        "any.required": "Written date is required",
        "date.base": "Written date can not be empty",
    })
}).unknown();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'POST') {
        let tokenData = req.headers.authorization;
        let token = tokenData?.split(' ')[1];

        if (!token || jwt.verify(token, JWT_SECRET) === null) { res.status(401).json({ success: false, message: 'Invalid token' }); return; }

        let userInfo = jwt.decode(token) as JWTPayload;
        if (userInfo.userType !== 'admin') { res.status(403).json({ success: false, message: 'Access denied' }); return; }

        const { heading, description, writtenBy, writtenDate } = req.body
        const options = {
            abortEarly: false,
        };

        const { error } = schema.validate({ heading, description, writtenBy, writtenDate }, options);

        if (error) {
            let errorMessage: string[] = [];

            error.details.forEach((e) => {
                errorMessage.push(e.message);
            });
            return res.status(400).json({ success: false, message: errorMessage.join(". <br>") });
        }
        const transaction = await sequelize.transaction();

        try {
            const blog = await Blog.create({
                heading,
                description,
                writtenBy,
                writtenDate
            })
            await transaction.commit();

            return res.status(200).json({ success: true, message: 'Blog created successfully', data: blog })
        } catch (err) {
            await transaction.rollback();
            return res.status(500).json({ success: false, message: (err as Error).message })
        }
    } else {
        res.status(405).json({ success: false, message: 'Method not allowed' })
    }
}