import { NextApiRequest, NextApiResponse } from 'next';
import { Project } from '@/models/__associations';
import sequelize from '@/config/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'POST') {
        const { id, status } = req.body

        const transaction = await sequelize.transaction();
        try {

            const project = await Project.findByPk(id);
            if (!project) {
                return res.status(404).json({ success: false, message: 'Project not found' });
            }
            project.projectStatus = status;
            await project.save({ transaction });

            await transaction.commit();
            return res.status(200).json({ success: true, message: 'Project status changed successfully', data: project })
        } catch (error) {
            await transaction.rollback();
            return res.status(500).json({ success: false, message: (error as Error).message })
        }
    } else {
        res.status(405).json({ success: false, message: 'Method not allowed' })
    }
}