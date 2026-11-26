import type { NextApiRequest, NextApiResponse } from 'next';
import { Op } from 'sequelize';
import { ProjectPartner, User } from '@/models/__associations';
import { requireAdmin, withCors } from '@/utils/auth';
import { assignableWhere } from '@/utils/reinvestAllocation';

/**
 * GET ?idProjects=<id>: active project partners who are not on this project
 * yet, for the reinvest dialog's "Add a partner" picker. Admins only.
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') return res.status(405).json({ success: false, message: 'Method not allowed' });
    const idProjects = Number(req.query.idProjects);
    if (!Number.isInteger(idProjects) || idProjects <= 0) return res.status(400).json({ success: false, message: 'Invalid project' });
    try {
        const onProject = (await ProjectPartner.findAll({ where: { idProjects }, attributes: ['idUsers'] })) as any[];
        const taken = onProject.map((r) => Number(r.idUsers));
        const users = (await User.findAll({
            where: { ...assignableWhere, ...(taken.length ? { idUsers: { [Op.notIn]: taken } } : {}) } as any,
            attributes: ['idUsers', 'fullName', 'location'],
            order: [['fullName', 'ASC']],
        })) as any[];
        return res.status(200).json({
            success: true,
            data: users.map((u) => ({ idUsers: Number(u.idUsers), fullName: String(u.fullName || `Partner #${u.idUsers}`), location: u.location || null })),
        });
    } catch (e) {
        return res.status(400).json({ success: false, message: (e as Error).message });
    }
}

export default withCors(requireAdmin(handler));
