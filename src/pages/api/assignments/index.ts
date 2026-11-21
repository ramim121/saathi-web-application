import type { NextApiRequest, NextApiResponse } from 'next';
import Joi from 'joi';
import { Op } from 'sequelize';
import { User } from '@/models/__associations';
import { requireAdmin, withCors } from '@/utils/auth';
import { assignPartners, CapacityError, partnerLoads, projectCapacities } from '@/utils/partnerCapacity';

/**
 * Partner assignment.
 *
 * GET: every project with its capacity, every project partner, and who is on
 *      what. The page works out its two views (by project, by partner) from it.
 * POST: { pairs: [{ idProjects, idUsers, capacity }] }. One project with many
 *      partners, one partner with many projects, or a copied partner set.
 */
const schema = Joi.object({
    pairs: Joi.array()
        .items(
            Joi.object({
                idProjects: Joi.number().integer().positive().required(),
                idUsers: Joi.number().integer().positive().required(),
                capacity: Joi.number().integer().min(1).max(100000).required().messages({
                    'number.base': 'Enter the units for every selected row',
                    'number.min': 'Units must be at least 1',
                    'number.integer': 'Units must be a whole number',
                }),
            }),
        )
        .min(1)
        .max(1000)
        .required()
        .messages({ 'array.min': 'Select at least one row' }),
});

async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
        if (req.method === 'GET') {
            const loads = await partnerLoads();
            const [projects, partners] = await Promise.all([
                projectCapacities(undefined, loads),
                User.findAll({
                    where: { userType: 'partner', partnerType: { [Op.in]: ['project', 'both'] }, status: { [Op.ne]: 'deleted' } },
                    attributes: ['idUsers', 'fullName', 'phoneNumber', 'location'],
                    order: [['fullName', 'ASC']],
                }),
            ]);
            return res.status(200).json({ success: true, data: { projects, partners, assignments: loads } });
        }
        if (req.method === 'POST') {
            const { error, value } = schema.validate(req.body, { abortEarly: true, stripUnknown: true });
            if (error) return res.status(400).json({ success: false, message: error.details[0].message });
            const result = await assignPartners(value.pairs);
            return res.status(200).json({ success: true, message: 'Partners assigned', data: result });
        }
        return res.status(405).json({ success: false, message: 'Method not allowed' });
    } catch (error) {
        const status = error instanceof CapacityError ? error.status : 400;
        return res.status(status).json({ success: false, message: (error as Error).message });
    }
}

export default withCors(requireAdmin(handler));
