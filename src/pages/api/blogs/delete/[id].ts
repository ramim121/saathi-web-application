import { NextApiRequest, NextApiResponse } from 'next';
import { Blog } from '@/models/__associations';
import { withCors, requireAdmin } from '@/utils/auth';

/**
 * SECURITY: previously unauthenticated — anyone could delete any blog post by
 * ID. Now admin-only, matching /api/blogs/create and /api/blogs/update/[id].
 */
async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    if (req.method !== 'DELETE') {
        res.status(405).json({ success: false, message: 'Method not allowed' });
        return;
    }

    try {
        const result = await Blog.findByPk(req.query.id as string);
        if (!result) {
            res.status(404).json({ success: false, message: 'Blog not found' });
            return;
        }

        await result.destroy();
        res.status(200).json({ success: true, message: 'Blog Deleted Successfully' });
    } catch (error) {
        res.status(400).json({ success: false, message: (error as Error).message });
    }
}

export default withCors(requireAdmin(handler));
