import { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '@/config/constants';
import JWTPayload from '@/types/JWTPayload';
import { ProjectInvestmentBooking } from '@/models/__associations';
import { withCors } from '@/utils/auth';
import bookingDetails from '@/pages/api/bookings/details/[id]';

/**
 * Booking details, ownership-checked. Phase F.
 *
 * `GET /api/bookings/details/{id}` is unauthenticated and takes the booking id
 * straight from the URL, so **any booking is readable by anyone who can guess a
 * sequential integer** — and the ids are sequential. It cannot be locked in
 * place: `OrderDetails` and `MyOrderDetails` in the shipped app call it, and
 * that app treats a 401 as a forced logout, so tightening it would eject users
 * mid-session rather than merely breaking a screen.
 *
 * So the original stays, and this route is what the website uses. It proves
 * ownership first, then delegates to the original for the query itself — the
 * projection is large and deeply nested, and a second copy would drift.
 *
 * Admins may read any booking; that matches the admin panel's existing access.
 *
 * Retire the original once the app ships a build pointing here.
 */

async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
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

    const id = Number(req.query.id);
    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid booking id' });
    }

    // Only the owning user id is read here — the full row is fetched by the
    // delegate below, and loading it twice would double the work for nothing.
    const booking = await ProjectInvestmentBooking.findOne({
        where: { idProjectInvestmentBookings: id },
        attributes: ['idProjectInvestmentBookings', 'idUsers'],
    });

    if (!booking) {
        return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (userInfo.userType !== 'admin' && Number(booking.idUsers) !== Number(userInfo.idUsers)) {
        // 404 rather than 403: a 403 confirms the booking exists, which is the
        // very fact this route is here to stop leaking.
        return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    return bookingDetails(req, res);
}

export default withCors(handler);
