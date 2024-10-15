import { NextApiRequest, NextApiResponse } from 'next';
import { ProjectInvestmentBooking } from '@/models/__associations';

export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse
): Promise<void> {
	if (req.method === 'PUT') {
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
