import { NextApiRequest, NextApiResponse } from 'next';
import { ProjectInvestmentBooking, User } from '@/models/__associations';
import Joi from 'joi';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '@/config/constants';
import JWTPayload from '@/types/JWTPayload';
import { generateNotification } from '@/notifications';
const schema = Joi.object({
    bookingId: Joi.number().required().messages({
        'any.required': 'Booking ID is required',
        'number.base': 'Booking ID must be a number',
    }),
    paymentMethod: Joi.object({
        value: Joi.string().required().messages({
            'string.empty': 'Payment method cannot be empty',
            'any.required': 'Payment method must be selected',
        }),
        label: Joi.any() // No validation messages for label since it's optional and without specific checks
    }).required(),

    paymentDate: Joi.date().required().messages({
        'any.required': 'Payment date is required',
        'date.base': 'Payment date must be a date',
    }),
    paymentAmount: Joi.number().required().greater(1).messages({
        'any.required': 'Payment amount is required',
        'number.base': 'Payment amount must be a number',
        'number.greater': 'Payment amount must be greater than 1',
    }),
    transactionId: Joi.string().required().not().empty().messages({
        'any.required': 'Transaction ID is required',
        'string.base': 'Transaction ID must be a string',
        'string.empty': 'Transaction ID cannot be empty',
    }),
}).unknown();

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

        const { bookingId, paymentMethod, paymentDate, paymentAmount, transactionId } = req.body;

        const options = {
            abortEarly: false,
        };

        const { error } = schema.validate({ bookingId, paymentMethod, paymentDate, paymentAmount, transactionId }, options);
        if (error) {
            let errorMessage: string[] = [];

            error.details.forEach((e) => {
                errorMessage.push(e.message);
            });
            return res.status(400).json({ success: false, message: errorMessage.join(". <br>") });
        }

        try {

            const booking = await ProjectInvestmentBooking.findOne({
                where: {
                    bookingId,
                },
            });

            const investor = await User.findOne({
                where: { idUsers: booking?.idUsers }
            });

            if (!booking) {
                return res.status(404).json({
                    success: false,
                    message: 'Booking not found',
                });
            }

            booking.paymentMethod = paymentMethod.value;
            booking.paymentDate = paymentDate;
            booking.paymentAmount = paymentAmount;
            booking.transactionId = transactionId;
            booking.paymentConfirmationStatus = 'confirmed';
            await booking.save();

            await generateNotification('booking_active', {
                fullName: investor?.fullName,
                bookingId: booking.bookingId,
            }, investor!);

            return res.status(200).json({
                success: true,
                data: booking,
                message: 'Booking approved successfully',
            });
        } catch (err) {
            return res.status(500).json({ success: false, message: (err as Error).message })
        }
    } else {
        res.status(405).json({ success: false, message: 'Method not allowed' })
    }
}
