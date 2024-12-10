import { NextApiRequest, NextApiResponse } from 'next';
import { ProjectPartner } from '@/models/__associations';

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    if (req.method === 'DELETE') {
        try {

            const result = await ProjectPartner.findByPk(req.query.id as string);

            await result?.destroy();

            return res.status(200).json({ success: true, message: 'Partnership Deleted Successfully' });
        } catch (error) {
            return res.status(500).json({ success: false, message: (error as Error).message })
        }
    } else {
        res.status(405).json({ success: false, message: 'Method not allowed' })
    }
}