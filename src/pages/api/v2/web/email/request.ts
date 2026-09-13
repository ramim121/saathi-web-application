import { NextApiRequest, NextApiResponse } from 'next';
import { User } from '@/models/__associations';
import { withCors, readAuth } from '@/utils/auth';
import { issueEmailVerification, normaliseEmail } from '@/utils/emailVerification';

/**
 * POST /api/v2/web/email/request  { email, locale? }
 *
 * Sends a verification code and link to `email`, on behalf of the signed-in
 * account. Requires a session — this proves an address *for* an account, so
 * there has to be an account.
 *
 * WHY THIS IS A v2/web ROUTE AND NOT A CHANGE TO AN EXISTING ONE
 * The shipped app has its own profile-update path that writes `email` straight
 * onto the user with no verification. Changing that endpoint would change
 * behaviour for every installed app the moment this deploys. This is additive:
 * the website uses it now, the app adopts it at its next release, and until
 * then nothing the app does is altered.
 *
 * TELLING THE CALLER AN ADDRESS IS TAKEN
 * `issueEmailVerification` answers TAKEN when a live account already holds the
 * address. That does disclose that *some* account exists on it — but the caller
 * is already signed in, the alternative is a silent failure or a database
 * constraint error, and the honest answer is what routes them to the merge
 * flow, which is the thing they actually want.
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

    const auth = readAuth(req);
    if (!auth) {
        return res.status(401).json({ success: false, message: 'Sign in first' });
    }

    const { email, locale } = req.body ?? {};
    if (!email || typeof email !== 'string') {
        return res.status(400).json({ success: false, message: 'Email address is required' });
    }

    const user = await User.findOne({
        where: { idUsers: auth.idUsers, status: ['active', 'inactive'] },
    });
    if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Already proven, and unchanged: say so rather than sending another code.
    if (user.emailVerified === 'yes' && normaliseEmail(user.email ?? '') === normaliseEmail(email)) {
        return res.status(200).json({
            success: true,
            alreadyVerified: true,
            message: 'This address is already verified.',
        });
    }

    const result = await issueEmailVerification(user, email, locale === 'bn' ? 'bn' : 'en');

    if (!result.ok) {
        const status =
            result.code === 'COOLDOWN' ? 429 :
            result.code === 'TAKEN' ? 409 :
            result.code === 'SEND_FAILED' ? 502 : 400;

        return res.status(status).json({
            success: false,
            code: result.code,
            message: result.message,
            ...(result.retryAfterSeconds ? { retryAfterSeconds: result.retryAfterSeconds } : {}),
        });
    }

    return res.status(200).json({
        success: true,
        message: 'Verification code sent.',
        expiresInSeconds: result.expiresInSeconds,
    });
}

export default withCors(handler);
