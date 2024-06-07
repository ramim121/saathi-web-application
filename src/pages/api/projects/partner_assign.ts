import { NextApiRequest, NextApiResponse } from 'next';
import { ProjectPartner } from '@/models/__associations';
import Joi from 'joi';

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
        try {
            const partnerProject = await ProjectPartner.create({
                idProjects: project,
                idUsers: partner
            })

            return res.status(200).json({ partnerProject })
        } catch (err) {
            return res.status(500).json({ message: (err as Error).message })
        }
    } else {
        res.status(405).json({ message: 'Method not allowed' })
    }
}