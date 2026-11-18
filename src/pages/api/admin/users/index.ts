import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin, withCors } from '@/utils/auth';
import { listUsers, readUserFilters, USERS_PAGE_SIZE } from '@/utils/adminUsers';

/** GET: one page of the admin Users table, filtered (see src/utils/adminUsers.ts). */
async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, message: 'Method not allowed' });
    }
    try {
        const result = await listUsers(readUserFilters(req.query), Number(req.query.page) || 1, Number(req.query.pageSize) || USERS_PAGE_SIZE);
        return res.status(200).json({ success: true, ...result });
    } catch (error) {
        return res.status(400).json({ success: false, message: (error as Error).message });
    }
}

export default withCors(requireAdmin(handler));
