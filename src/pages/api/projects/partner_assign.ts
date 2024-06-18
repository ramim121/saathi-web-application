import { NextApiRequest, NextApiResponse } from 'next';
import { ProjectPartner } from '@/models/__associations';
import Joi from 'joi';
import sequelize from '@/config/db';

const schema = Joi.object({
    partner: Joi.number().required().messages({
        "any.required": "Partner is required",
        "number.base": "Partner must be selected",
    }),
    project: Joi.number().required().messages({
        "any.required": "Project is required",
        "number.base": "Project must be selected",
    })
}).unknown();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'POST') {
        const { partner, project } = req.body
        const options = {
            abortEarly: false,
        };
        const { error } = schema.validate({ partner, project }, options);
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
                idUsers: partner
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