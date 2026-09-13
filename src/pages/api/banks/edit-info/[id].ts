import { NextApiRequest, NextApiResponse } from 'next';
import { Bank, UserBank, BankBranch } from '@/models/__associations';
import { withCors, requireUser, canAccess, type AuthContext } from '@/utils/auth';

/**
 * Prefill for the "edit bank account" form.
 *
 * SECURITY: previously unauthenticated. Requires a token now, and the row must
 * belong to the caller unless they are an admin.
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

    try {
        const result = await UserBank.findOne({
            where: { idUserBanks: req.query.id },
            include: [
                { model: Bank, required: true },
                { model: BankBranch, required: true },
            ],
        });

        if (!result) {
            res.status(404).json({ success: false, message: 'Bank account not found' });
            return;
        }

        if (!canAccess(auth, (result as unknown as { idUsers: number }).idUsers)) {
            res.status(403).json({ success: false, message: 'Access denied' });
            return;
        }

        res.status(200).json({ success: true, data: result });
    } catch (error) {
        res.status(400).json({ success: false, message: (error as Error).message });
    }
}

export default withCors(requireUser(handler));
