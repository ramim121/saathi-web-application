import { NextApiRequest, NextApiResponse } from 'next';
import { Project } from '@/models/__associations';
import { User } from '@/models/__associations';

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    if (req.method === 'GET') {
        try {

            const result = await Project.findAll({
                attributes: [
                    'idProjects',
                    'projectName',
                    'returnRangeMin',
                    'returnRangeMax',
                    'investmentType',
                    'returnType',
                    'duration',
                    'tenure',
                    'location',
                    'unitInvestmentValue',
                    'projectStatus'
                ],
                include: [{model: User, as: 'CreatedBy', attributes: ['fullName']}],
            });

            return res.status(200).json(result);
        } catch (error) {
            console.error(error);
            return res.status(500).json({ error: 'Server error' });
        }
    } else {
        res.status(405).json({ error: 'Method not allowed' });
    }
}