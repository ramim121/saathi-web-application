import { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '@/config/constants';
import JWTPayload from '@/types/JWTPayload';
import { User } from '@/models/__associations';
import { withCors } from '@/utils/auth';
import createBooking from '@/pages/api/bookings/create';
import { checkNidEligibility } from '@/utils/nidGate';

/**
 * Booking creation **for the website only**.
 *
 * WHY THIS EXISTS
 * It pre-dates the NID check being enabled in `POST /api/bookings/create`. At
 * the time that route enforced contact verification but not NID — the check was
 * present and commented out — and the website's rule was already the stricter
 * one, so this wrapper added the missing guard.
 *
 * The original route now runs the same guard, from the same shared helper, so
 * this file no longer adds a rule. It is kept because the website calls this
 * path and because the contact-verification wording below is the site's rather
 * than the app's. If the two ever need to differ again, this is where that
 * belongs; until then both go through `checkNidEligibility`, which is the point
 * — the rule cannot be changed in one place and forgotten in the other.
 *
 * WHY THIS DELEGATES INSTEAD OF COPYING
 * Everything after the eligibility check — booking id allocation, the
 * transaction across `project_investors` and `project_partner_investors`, unit
 * accounting, notifications — is intricate and must not exist in two versions
 * that can drift. So this route adds the missing guard and then calls the
 * original handler, which repeats its own token check and does the work. The
 * duplicated part is the guard; the valuable part is shared.
 */

async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ success: false, message: 'Token not found' });
    }

    let userInfo: JWTPayload;
    try {
        jwt.verify(token, JWT_SECRET);
        userInfo = jwt.decode(token) as JWTPayload;
    } catch {
        return res.status(401).json({ success: false, message: 'Invalid token' });
    }

    const user = await User.findOne({
        where: { idUsers: userInfo.idUsers },
        attributes: ['idUsers', 'status', 'emailVerified', 'phoneVerified', 'nidVerified', 'nidVerificationStatus'],
    });

    if (!user || user.status === 'deleted') {
        return res.status(404).json({ success: false, message: 'Investor not found' });
    }

    // A verified phone OR a verified email. Either is enough; both is optional.
    if (user.emailVerified !== 'yes' && user.phoneVerified !== 'yes') {
        return res.status(400).json({
            success: false,
            code: 'CONTACT_UNVERIFIED',
            message: 'Verify your phone number or email address before investing.',
        });
    }

    // NID must be *approved*, not merely submitted. Each refusal carries its own
    // code and sentence: "we are reviewing it", "we turned it down, send it
    // again", and "you have not done this" are three different situations and
    // the first two both used to read as the third.
    //
    // Shared with api/bookings/create so the app and the site cannot drift.
    const nidRefusal = checkNidEligibility(user);
    if (nidRefusal) {
        return res.status(400).json({ success: false, ...nidRefusal });
    }

    // Eligible. Hand off to the original implementation.
    return createBooking(req, res);
}

export default withCors(handler);
