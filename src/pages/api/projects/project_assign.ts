import { NextApiRequest, NextApiResponse } from 'next';
import Joi from 'joi';
import { requireAdmin, withCors } from '@/utils/auth';
import { assignPartners, CapacityError } from '@/utils/partnerCapacity';

/** Kept for existing callers. The rules live in utils/partnerCapacity. */
const schema = Joi.object({
    project: Joi.number().integer().positive().required().messages({ 'any.required': 'Project is required', 'number.base': 'Project must be selected' }),
    partners: Joi.array()
        .items(
            Joi.object({
                partner: Joi.number().integer().positive().required().messages({ 'any.required': 'Partner is required', 'number.base': 'Partner must be selected' }),
                partnerUnitCapacity: Joi.number().integer().min(1).required().messages({
                    'any.required': 'Partner unit capacity is required',
                    'number.base': 'Partner unit capacity must be a number',
                    'number.min': 'Partner unit capacity must be greater than 0',
                }),
            }),
        )
        .min(1)
        .required()
        .messages({ 'any.required': 'At least one partner is required', 'array.min': 'At least one partner is required' }),
}).unknown();

async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });
    const { error, value } = schema.validate(req.body, { abortEarly: false });
    if (error) return res.status(400).json({ success: false, message: error.details.map((e) => e.message).join('. <br>') });
    try {
        const pairs = value.partners.map((p: { partner: number; partnerUnitCapacity: number }) => ({ idProjects: value.project, idUsers: p.partner, capacity: p.partnerUnitCapacity }));
        const data = await assignPartners(pairs);
        if (!data.created) return res.status(400).json({ success: false, message: 'These partners are already on this project.' });
        return res.status(200).json({ success: true, message: 'Partners assigned successfully', data });
    } catch (err) {
        return res.status(err instanceof CapacityError ? err.status : 400).json({ success: false, message: (err as Error).message });
    }
}

export default withCors(requireAdmin(handler));
