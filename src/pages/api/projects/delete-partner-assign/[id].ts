import { NextApiRequest, NextApiResponse } from 'next';
import { ProjectPartner, Project } from '@/models/__associations';
import sequelize from '@/config/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    if (req.method === 'DELETE') {
        const transaction = await sequelize.transaction();
        try {

            const result = await ProjectPartner.findByPk(req.query.id as string);

            const projectDetails = await Project.findOne({
                where: { idProjects: result?.idProjects }
            });

            if (!projectDetails) {
                await transaction.rollback();
                return res.status(404).json({ success: false, message: 'Project not found' });
            }

            const updatedTotalUnits = projectDetails.totalAvailableUnits - (result?.partnerUnitCapacity ?? 0);

            const updateUnits = await Project.update(
                { totalAvailableUnits: updatedTotalUnits }, // Fields to update
                { where: { idProjects: result?.idProjects }, transaction } // Conditions and transaction
            );

            await result?.destroy();
            await transaction.commit();

            return res.status(200).json({ success: true, message: 'Partnership Deleted Successfully' });
        } catch (error) {
            return res.status(500).json({ success: false, message: (error as Error).message })
        }
    } else {
        res.status(405).json({ success: false, message: 'Method not allowed' })
    }
}