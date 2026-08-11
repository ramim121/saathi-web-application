import { NextApiRequest, NextApiResponse } from 'next';
import { ProjectPartner, Project } from '@/models/__associations';
import sequelize from '@/config/db';
import { withCors, requireAdmin } from '@/utils/auth';

/**
 * Detach a partner from a project and give back their unit allocation.
 *
 * SECURITY: previously unauthenticated — anyone could detach any partner and
 * mutate a project's `totalAvailableUnits`. Now admin-only.
 *
 * Also fixed: the original `catch` never rolled the transaction back, so a
 * failure after the `Project.update` left the connection holding an open
 * transaction until it timed out.
 */
async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    if (req.method !== 'DELETE') {
        res.status(405).json({ success: false, message: 'Method not allowed' });
        return;
    }

    const transaction = await sequelize.transaction();
    try {
        const result = await ProjectPartner.findByPk(req.query.id as string, { transaction });
        if (!result) {
            await transaction.rollback();
            res.status(404).json({ success: false, message: 'Partner assignment not found' });
            return;
        }

        const projectDetails = await Project.findOne({
            where: { idProjects: result.idProjects },
            transaction,
        });

        if (!projectDetails) {
            await transaction.rollback();
            res.status(404).json({ success: false, message: 'Project not found' });
            return;
        }

        const updatedTotalUnits =
            projectDetails.totalAvailableUnits - (result.partnerUnitCapacity ?? 0);

        await Project.update(
            { totalAvailableUnits: updatedTotalUnits },
            { where: { idProjects: result.idProjects }, transaction },
        );

        await result.destroy({ transaction });
        await transaction.commit();

        res.status(200).json({ success: true, message: 'Partnership Deleted Successfully' });
    } catch (error) {
        await transaction.rollback();
        res.status(400).json({ success: false, message: (error as Error).message });
    }
}

export default withCors(requireAdmin(handler));
