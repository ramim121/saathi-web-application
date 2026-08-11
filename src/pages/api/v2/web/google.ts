import { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import { Op } from 'sequelize';
import { OAuth2Client } from 'google-auth-library';
import { GOOGLE_CLIENT_ID, JWT_SECRET } from '@/config/constants';
import { User } from '@/models/__associations';
import { withCors } from '@/utils/auth';
import { normaliseEmail } from '@/utils/emailVerification';
import { needsProfile, bookingBlockers } from '@/utils/profileCompletion';
import { generateNotification } from '@/notifications';

/**
 * Google sign-in and sign-up **for the website only**.
 *
 *   POST { idToken } → { token, user, isNew, needsProfile, bookingBlockers }
 *
 * WHY THIS EXISTS RATHER THAN REUSING /api/auth/google
 * That route is what the shipped app calls. Changing it changes behaviour for
 * every installed app the moment this deploys, and it carries a defect that
 * must not be fixed there in a hurry (see below). This one serves the website,
 * where the rules can change on a deploy because the client ships with it.
 *
 * THE DUPLICATE-ACCOUNT DEFECT THIS ROUTE DOES NOT HAVE
 * `/api/auth/google` looks an account up with
 *
 *     email = X AND (googleLogin='yes' OR appleLogin='yes' OR emailVerified='yes')
 *
 * and *creates a new account* when that misses. So somebody who typed their
 * address into their profile without confirming it does not match, and signing
 * in with Google hands them a brand-new second account. Three such pairs were
 * found in the live data and have been merged.
 *
 * The naive fix — match on email alone — is an account-takeover vector: if
 * Alice types bob@gmail.com into her profile, Bob signing in with Google would
 * be handed Alice's account. Proving a Google address is strong evidence about
 * the *address*, not about *that account*.
 *
 * WHAT THIS ROUTE DOES INSTEAD
 *
 *   1. address is held by an account that *proved* it  → sign in;
 *   2. address is held by an account that merely *claimed* it, unverified →
 *      release the claim and sign the prover up. An unverified address is an
 *      assertion nobody checked, and it loses to somebody holding the mailbox.
 *      Refused if releasing it would leave that account with no way back in;
 *   3. address is held by nobody → create the account.
 *
 * Case 3 is new. Signup used to be app-only; it now happens here too. The
 * financial bar is untouched — `bookingBlockers` still requires a verified NID
 * before any money moves, so a web signup can browse and complete a profile and
 * nothing else.
 */

const client = new OAuth2Client(GOOGLE_CLIENT_ID);

/** Never widen this to `*`; it is what keeps NID and bank columns off the wire. */
const WEB_USER_ATTRIBUTES = [
    'idUsers',
    'fullName',
    'fullNameBn',
    'gender',
    'email',
    'phoneNumber',
    'userType',
    'profileImage',
    'dateOfBirth',
    'emailVerified',
    'phoneVerified',
    'nidVerified',
    'nidVerificationStatus',
    'status',
] as const;

function publicUser(user: InstanceType<typeof User> | Record<string, unknown>) {
    const source = user as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of WEB_USER_ATTRIBUTES) out[key] = source[key] ?? null;
    return out;
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

    const { idToken } = req.body ?? {};
    if (!idToken) {
        return res.status(400).json({ success: false, message: 'ID token is required' });
    }

    let email: string;
    let googleId: string;
    let googleName: string | null = null;

    try {
        const ticket = await client.verifyIdToken({ idToken, audience: GOOGLE_CLIENT_ID });
        const payload = ticket.getPayload();

        if (!payload?.email || !payload.sub) {
            return res.status(400).json({ success: false, message: 'Invalid ID token' });
        }
        // Google asserts the address only when this is true. Without the check,
        // every rule below about "proved the address" is worthless.
        if (payload.email_verified === false) {
            return res
                .status(400)
                .json({ success: false, message: 'This Google account has an unverified email' });
        }

        email = normaliseEmail(payload.email);
        googleId = payload.sub;
        googleName = payload.name ?? null;
    } catch {
        return res.status(400).json({ success: false, message: 'Invalid ID token' });
    }

    /* ------------------------------------------------- 1. an existing owner -- */

    const holder = await User.findOne({ where: { email, status: ['active', 'inactive'] } });

    if (holder) {
        const proved =
            holder.emailVerified === 'yes' ||
            holder.googleLogin === 'yes' ||
            holder.appleLogin === 'yes';

        if (proved) {
            // Link the Google id if this is the first Google sign-in on an
            // account that verified its address some other way, so the next one
            // matches on the id rather than only the address.
            if (holder.googleLogin !== 'yes' || !holder.googleId) {
                holder.googleLogin = 'yes';
                holder.googleId = holder.googleId || googleId;
                await holder.save();
            }
            return respond(res, holder, false);
        }

        /* ------------------------------- 2. an unverified claim on the address -- */

        // Releasing the claim must not lock that account out. Every live
        // account holding an unverified address currently has a verified phone,
        // so this branch is defensive rather than expected — but "currently" is
        // a fact about today's data, not a guarantee.
        const stillReachable = holder.phoneVerified === 'yes' && !!holder.phoneNumber;

        if (!stillReachable) {
            return res.status(409).json({
                success: false,
                code: 'ADDRESS_CONTESTED',
                message:
                    'Another Shathi account lists this email address and has no other way to sign in. ' +
                    'Please contact info@digigramventures.com so we can sort it out.',
            });
        }

        holder.email = null as unknown as string;
        holder.emailVerified = 'no';
        await holder.save();
    }

    /* -------------------------------------------------------- 3. sign them up -- */

    const user = new User();
    user.email = email;
    user.emailVerified = 'yes';
    user.googleId = googleId;
    user.googleLogin = 'yes';
    // Google's display name is a starting point, not an answer: the signup step
    // asks for name and gender, and `needsProfile` stays true until gender is
    // answered regardless of what Google supplied.
    if (googleName) user.fullName = googleName;
    await user.save();

    // Fire-and-forget; a failure here must not fail the signup. It also cannot
    // send until the address is verified, which it now is.
    void generateNotification('signup_completion', user, user).catch(() => {});

    return respond(res, user, true);
}

function respond(
    res: NextApiResponse,
    user: InstanceType<typeof User>,
    isNew: boolean,
) {
    return res.status(200).json({
        success: true,
        isNew,
        needsProfile: needsProfile(user),
        bookingBlockers: bookingBlockers(user),
        token: jwt.sign(
            { idUsers: Number(user.idUsers), userType: user.userType ?? 'investor' },
            JWT_SECRET,
            { expiresIn: '30d' },
        ),
        user: publicUser(user),
    });
}

export default withCors(handler);
