import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin, withCors } from '@/utils/auth';
import { getUserDetails } from '@/utils/adminUsers';

/** GET: one user for the admin Users page's details and bank dialogs. */
async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, message: 'Method not allowed' });
    }
    const id = Number(req.query.id);
    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid user id' });
    }
    try {
        const user = await getUserDetails(id);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        return res.status(200).json({ success: true, data: user });
    } catch (error) {
        return res.status(400).json({ success: false, message: (error as Error).message });
    }
}

export default withCors(requireAdmin(handler));
