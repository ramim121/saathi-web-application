import { NextApiRequest, NextApiResponse } from 'next';
import { User } from '@/models/__associations';
import { withCors, requireAdmin } from '@/utils/auth';

/**
 * Every investor's name, email and phone number.
 *
 * SECURITY: previously unauthenticated, so the whole investor base could be
 * dumped by anyone who knew the URL. Now admin-only.
 *
 * Safe to lock in place: a scan of saathi-mobile-app found no caller — this
 * endpoint is only used by the admin UI.
 */
async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    if (req.method !== 'GET') {
        res.status(405).json({ success: false, message: 'Method not allowed' });
        return;
    }

    try {
        const result = await User.findAll({
            attributes: ['idUsers', 'fullName', 'email', 'phoneNumber'],
            where: { userType: 'investor' },
        });

        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, message: (error as Error).message });
    }
}

export default withCors(requireAdmin(handler));
