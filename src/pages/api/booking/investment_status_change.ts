import { NextApiRequest, NextApiResponse } from 'next';
import { ProjectInvestor } from '@/models/__associations';
import sequelize from '@/config/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'PUT') {
        const { idProjectInvestors, investmentStatus } = req.body

        const transaction = await sequelize.transaction();
        try {

            const investor = await ProjectInvestor.findByPk(idProjectInvestors);
            if (!investor) {
                return res.status(404).json({ success: false, message: 'Project investor not found' });
            }
            investor.investmentStatus = investmentStatus;
            await investor.save({ transaction });

            await transaction.commit();
            return res.status(200).json({ success: true, message: 'Investment status changed successfully', data: investor })
        } catch (error) {
            await transaction.rollback();
            return res.status(500).json({ success: false, message: (error as Error).message })
        }
    } else {
        res.status(405).json({ success: false, message: 'Method not allowed' })
    }
}