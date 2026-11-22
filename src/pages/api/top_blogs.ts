import { NextApiRequest, NextApiResponse } from 'next';
import { Blog } from '@/models/__associations';

export default async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    if (req.method === 'GET') {
        try {

            // Newest first. With no order MySQL returned whichever three rows it
            // found first, usually the oldest posts, under "Latest Insights".
            const result = await Blog.findAll({
                limit: 3,
                order: [['writtenDate', 'DESC'], ['idBlogs', 'DESC']],
            });

            return res.status(200).json({ success: true, data: result });
        } catch (error) {
            return res.status(400).json({ success: false, message: (error as Error).message })
        }
    } else {
        res.status(405).json({ success: false, message: 'Method not allowed' })
    }
}