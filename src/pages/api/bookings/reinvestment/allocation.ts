import type { NextApiRequest, NextApiResponse } from 'next';
import Joi from 'joi';
import { ProjectInvestor } from '@/models/__associations';
import { requireAdmin, withCors } from '@/utils/auth';
import { planReinvestAllocation } from '@/utils/reinvestAllocation';

/**
 * POST { idProjectInvestors, idProjects, units, raises? }: how the reinvest
 * dialog's units would split across the project's partners (round robin),
 * with any capacity raises the admin typed, and what still blocks it.
 * Read only: nothing is saved. Admins only.
 */
const schema = Joi.object({
    idProjectInvestors: Joi.number().integer().positive().required(),
    idProjects: Joi.number().integer().positive().required(),
    units: Joi.number().integer().min(1).max(100000).required(),
    raises: Joi.array()
        .items(Joi.object({ idProjectPartners: Joi.number().integer().positive().required(), capacity: Joi.number().integer().min(0).max(1000000).required() }))
        .max(100)
        .default([]),
    newPartners: Joi.array()
        .items(Joi.object({ idUsers: Joi.number().integer().positive().required(), capacity: Joi.number().integer().min(1).max(1000000).required() }))
        .max(20)
        .default([]),
});

async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });
    const { error, value } = schema.validate(req.body ?? {}, { abortEarly: false });
    if (error) return res.status(400).json({ success: false, message: error.details.map((d) => d.message).join('. ') });
    try {
        const line = (await ProjectInvestor.findByPk(value.idProjectInvestors, { attributes: ['idUsers'] })) as any;
        if (!line) return res.status(404).json({ success: false, message: 'Investment not found' });
        const plan = await planReinvestAllocation({
            idProjects: value.idProjects,
            units: value.units,
            idUsers: Number(line.idUsers),
            leavingLine: value.idProjectInvestors,
            raises: value.raises,
            newPartners: value.newPartners,
        });
        return res.status(200).json({ success: true, data: plan });
    } catch (e) {
        return res.status(400).json({ success: false, message: (e as Error).message });
    }
}

export default withCors(requireAdmin(handler));
