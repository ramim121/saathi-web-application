import { NextApiRequest, NextApiResponse } from 'next';
import { withCors, readAuth } from '@/utils/auth';
import { verifyEmailCode, verifyEmailToken } from '@/utils/emailVerification';

/**
 * POST /api/v2/web/email/verify   { code }   — needs a session
 * POST /api/v2/web/email/verify   { token }  — does not
 *
 * Two ways in, because the two challenges reach the user differently.
 *
 * THE CODE PATH NEEDS A SESSION, THE LINK PATH DOES NOT.
 * A six-digit code is only meaningful next to "which account is this for", so
 * it is scoped to the signed-in user and attempt-counted; without that scoping
 * a code could be replayed against a different account.
 *
 * A link token is 32 random bytes and identifies the challenge by itself, so it
 * carries its own authorisation. That is what makes it work when it is opened
 * in whichever browser the mail app happens to launch — which is the entire
 * reason for offering a link, and would be defeated by requiring a session
 * there too.
 *
 * WHAT SUCCESS MEANS
 * `email_verified = 'yes'` on the requesting account, and nothing more. It does
 * not merge anything: a merge needs proof of the *other* account's phone as
 * well, and that lives in the merge route.
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

    const { code, token } = req.body ?? {};

    if (!code && !token) {
        return res.status(400).json({ success: false, message: 'A code or a token is required' });
    }

    const result = token
        ? await verifyEmailToken(String(token))
        : await (async () => {
              const auth = readAuth(req);
              if (!auth) {
                  return {
                      ok: false as const,
                      code: 'INVALID' as const,
                      message: 'Sign in first',
                  };
              }
              return verifyEmailCode(auth.idUsers, String(code));
          })();

    if (!result.ok) {
        const status =
            result.code === 'TOO_MANY' ? 429 :
            result.code === 'TAKEN' ? 409 : 400;

        return res.status(status).json({
            success: false,
            code: result.code,
            message: result.message,
        });
    }

    return res.status(200).json({
        success: true,
        message: 'Email address verified.',
        email: result.email,
        user: {
            idUsers: result.user.idUsers,
            fullName: result.user.fullName,
            email: result.user.email,
            phoneNumber: result.user.phoneNumber,
            emailVerified: result.user.emailVerified,
            phoneVerified: result.user.phoneVerified,
        },
    });
}

export default withCors(handler);
