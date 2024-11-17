import { NextApiRequest, NextApiResponse } from 'next';
import { ProjectInvestmentBooking } from '@/models/__associations';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '@/config/constants';
import JWTPayload from '@/types/JWTPayload';
export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse
): Promise<void> {
	if (req.method === 'PUT') {
		let tokenData = req.headers.authorization;
		let token = tokenData?.split(' ')[1];

		if (!token || jwt.verify(token, JWT_SECRET) === null) { res.status(401).json({ success: false, message: 'Invalid token' }); return; }

		let userInfo = jwt.decode(token) as JWTPayload;
		if (userInfo.userType !== 'admin') { res.status(403).json({ success: false, message: 'Access denied' }); return; }

		const { bookingId, paymentConfirmationStatus } = req.body;

		try {
			const booking = await ProjectInvestmentBooking.findOne({
				where: {
					bookingId,
				},
			});

			if (!booking) {
				return res.status(404).json({
					success: false,
					message: 'Booking not found',
				});
			}

			booking.paymentConfirmationStatus = paymentConfirmationStatus;
			await booking.save();

			return res.status(200).json({
				success: true,
				data: booking,
				message: 'Booking denied successfully',
			});
		} catch (err) {
			return res.status(500).json({ success: false, message: (err as Error).message })
		}
	} else {
		res.status(405).json({ success: false, message: 'Method not allowed' })
	}
}
