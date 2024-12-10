import { NextApiRequest, NextApiResponse } from 'next';
import { ProjectPartner } from '@/models/__associations';
import Joi from 'joi';
import sequelize from '@/config/db';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '@/config/constants';
import JWTPayload from '@/types/JWTPayload';

const schema = Joi.object({
    partner: Joi.number().required().messages({
        "any.required": "Partner is required",
        "number.base": "Partner must be selected",
    }),
    project: Joi.number().required().messages({
        "any.required": "Project is required",
        "number.base": "Project must be selected",
    }),
    partnerUnitCapacity: Joi.number().greater(0).required().messages({
        "any.required": "Partner unit capacity is required",
        "number.base": "Partner unit capacity must be a number",
        "number.greater": "Partner unit capacity must be greater than 0",
    }),
}).unknown();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'POST') {
        let tokenData = req.headers.authorization;
        let token = tokenData?.split(' ')[1];

        if (!token || jwt.verify(token, JWT_SECRET) === null) { res.status(401).json({ success: false, message: 'Invalid token' }); return; }

        let userInfo = jwt.decode(token) as JWTPayload;
        if (userInfo.userType !== 'admin') { res.status(403).json({ success: false, message: 'Access denied' }); return; }

        const { partner, project, partnerUnitCapacity } = req.body

        const options = {
            abortEarly: false,
        };
        const { error } = schema.validate({ partner, project, partnerUnitCapacity }, options);
        if (error) {
            let errorMessage: string[] = [];

            error.details.forEach((e) => {
                errorMessage.push(e.message);
            });
            return res.status(400).json({ success: false, message: errorMessage.join(". <br>") });
        }
        const transaction = await sequelize.transaction();
        try {
            const partnerProject = await ProjectPartner.create({
                idProjects: project,
                idUsers: partner,
                partnerUnitCapacity: partnerUnitCapacity
            }, { transaction });
            await transaction.commit();
            return res.status(200).json({ success: true, message: 'Partner assigned successfully', data: partnerProject })
        } catch (error) {
            await transaction.rollback();
            return res.status(500).json({ success: false, message: (error as Error).message })
        }
    } else {
        res.status(405).json({ success: false, message: 'Method not allowed' })
    }
}