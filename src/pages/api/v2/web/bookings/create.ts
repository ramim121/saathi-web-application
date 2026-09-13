import { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '@/config/constants';
import JWTPayload from '@/types/JWTPayload';
import { User } from '@/models/__associations';
import { withCors } from '@/utils/auth';
import createBooking from '@/pages/api/bookings/create';

/**
 * Booking creation **for the website only**.
 *
 * WHY THIS EXISTS
 * `POST /api/bookings/create` enforces contact verification but **not** NID:
 * the NID check is present and commented out (see the block above the
 * transaction in that file). The website's rule is stricter — a verified
 * contact **and** a verified NID are both required before a booking.
 *
 * Turning the check back on in the original route would change behaviour for
 * the shipped mobile app, where an unknown number of existing investors have no
 * verified NID and would suddenly be unable to book. That is a product
 * decision, not a refactor, so the original is left exactly as it is.
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

    // NID must be *approved*, not merely submitted. `pending` is reported with
    // its own code so the site can say "we are reviewing it" rather than
    // "you have not done this", which reads as though the upload was lost.
    if (user.nidVerified !== 'yes') {
        const pending = user.nidVerificationStatus === 'pending';
        return res.status(400).json({
            success: false,
            code: pending ? 'NID_PENDING' : 'NID_UNVERIFIED',
            message: pending
                ? 'Your NID is still being reviewed. You can invest as soon as it is approved.'
                : 'Verify your NID before investing.',
        });
    }

    // Eligible. Hand off to the original implementation.
    return createBooking(req, res);
}

export default withCors(handler);
