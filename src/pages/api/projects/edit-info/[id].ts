import { NextApiRequest, NextApiResponse } from 'next';
import { Project } from '@/models/__associations';
import { File, ProjectCategory } from '@/models/__associations';
import Cors from 'micro-cors';

const cors = Cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS', 'PUT'],
    allowHeaders: ['X-Requested-With', 'Authorization', 'Content-Type'],
});

async function handler(req: NextApiRequest, res: NextApiResponse): Promise<any> {
    if (req.method === 'OPTIONS') { return res.status(200).end(); }
    if (req.method === 'GET') {
        try {
            const result = await Project.findOne({
                include: [

                    {
                        model: File, as: 'MainImage'
                    },
                    {
                        model: File, as: 'FeaturedImages'
                    },
                    {
                        model: ProjectCategory,
                        as: 'ProjectCategory'
                    },

                ],
                where: {
                    idProjects: req.query.id
                },
            });

            return res.status(200).json({ success: true, data: result });
        } catch (error) {
            return res.status(500).json({ success: false, message: (error as Error).message })
        }
    } else {
        res.status(405).json({ success: false, message: 'Method not allowed' })
    }
}

export default cors(handler as any);