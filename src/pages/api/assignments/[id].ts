import type { NextApiRequest, NextApiResponse } from 'next';
import Joi from 'joi';
import { requireAdmin, withCors } from '@/utils/auth';
import { CapacityError, updateAssignmentCapacity } from '@/utils/partnerCapacity';

/** PUT { capacity }: change what one partner can hold on one project. */
const schema = Joi.object({
    capacity: Joi.number().integer().min(1).max(100000).required().messages({
        'any.required': 'Enter the units',
        'number.base': 'Enter the units',
        'number.min': 'Units must be at least 1',
        'number.integer': 'Units must be a whole number',
    }),
});

async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'PUT') return res.status(405).json({ success: false, message: 'Method not allowed' });
    const id = Number(req.query.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ success: false, message: 'Invalid assignment' });
    const { error, value } = schema.validate(req.body, { stripUnknown: true });
    if (error) return res.status(400).json({ success: false, message: error.details[0].message });
    try {
        const result = await updateAssignmentCapacity(id, value.capacity);
        return res.status(200).json({ success: true, message: 'Capacity updated', data: result });
    } catch (err) {
        const status = err instanceof CapacityError ? err.status : 400;
        return res.status(status).json({ success: false, message: (err as Error).message });
    }
}

export default withCors(requireAdmin(handler));
