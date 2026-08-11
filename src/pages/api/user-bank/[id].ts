import { NextApiRequest, NextApiResponse } from 'next';
import { UserBank, Bank, BankBranch } from '@/models/__associations';
import { withCors, requireUser, canAccess, type AuthContext } from '@/utils/auth';

/**
 * Bank accounts belonging to a user.
 *
 * SECURITY: previously unauthenticated, and keyed on a user ID taken straight
 * from the URL — so the whole investor base's bank details could be walked by
 * incrementing an integer. Now requires a token, and a non-admin may only read
 * their own.
 */
async function handler(
    req: NextApiRequest,
    res: NextApiResponse,
    auth: AuthContext,
): Promise<void> {
    if (req.method !== 'GET') {
        res.status(405).json({ success: false, message: 'Method not allowed' });
        return;
    }

    if (!canAccess(auth, req.query.id as string)) {
        res.status(403).json({ success: false, message: 'Access denied' });
        return;
    }

    try {
        const result = await UserBank.findAll({
            include: [{ model: Bank }, { model: BankBranch }],
            where: { idUsers: req.query.id },
        });

        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ success: false, message: (error as Error).message });
    }
}

export default withCors(requireUser(handler));
