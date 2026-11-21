import { NextApiRequest, NextApiResponse } from 'next';
import Joi from 'joi';
import { requireAdmin, withCors } from '@/utils/auth';
import { assignPartners, CapacityError } from '@/utils/partnerCapacity';

/** Kept for existing callers. The rules live in utils/partnerCapacity. */
const schema = Joi.object({
    partner: Joi.number().integer().positive().required().messages({ 'any.required': 'Partner is required', 'number.base': 'Partner must be selected' }),
    project: Joi.number().integer().positive().required().messages({ 'any.required': 'Project is required', 'number.base': 'Project must be selected' }),
    partnerUnitCapacity: Joi.number().integer().min(1).required().messages({
        'any.required': 'Partner unit capacity is required',
        'number.base': 'Partner unit capacity must be a number',
        'number.min': 'Partner unit capacity must be greater than 0',
    }),
}).unknown();

async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });
    const { error, value } = schema.validate(req.body, { abortEarly: false });
    if (error) return res.status(400).json({ success: false, message: error.details.map((e) => e.message).join('. <br>') });
    try {
        const data = await assignPartners([{ idProjects: value.project, idUsers: value.partner, capacity: value.partnerUnitCapacity }]);
        if (!data.created) return res.status(400).json({ success: false, message: 'This partner is already on this project.' });
        return res.status(200).json({ success: true, message: 'Partner assigned successfully', data });
    } catch (err) {
        return res.status(err instanceof CapacityError ? err.status : 400).json({ success: false, message: (err as Error).message });
    }
}

export default withCors(requireAdmin(handler));
