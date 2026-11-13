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
 * The website calls this path. It answers an unverified contact with the site's
 * own wording and a machine-readable `CONTACT_UNVERIFIED` code, which the
 * shared route does not return, and it refuses a deleted account.
 *
 * It used to enforce NID approval as well. That rule is gone: since 2026-11-13
 * an approved NID is not required to book, here or in
 * `POST /api/bookings/create`. A verified phone or email is the only
 * eligibility rule left on either route.
 *
 * WHY THIS DELEGATES INSTEAD OF COPYING
 * Everything after the eligibility check — booking id allocation, the
 * transaction across `project_investors` and `project_partner_investors`, unit
 * accounting, notifications — is intricate and must not exist in two versions
 * that can drift. So this route checks contact verification and then calls the
 * original handler, which repeats its own token check and does the work.
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
        attributes: ['idUsers', 'status', 'emailVerified', 'phoneVerified'],
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

    // Eligible. Hand off to the original implementation.
    return createBooking(req, res);
}

export default withCors(handler);
