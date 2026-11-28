import { NextApiRequest, NextApiResponse } from 'next';
import { ProjectInvestmentBooking, User, ProjectInvestor, Project } from '@/models/__associations';
import Joi from 'joi';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '@/config/constants';
import JWTPayload from '@/types/JWTPayload';
import { generateNotification } from '@/notifications';
import sequelize from '@/config/db';
import BookingStatusEntry from '@/utils/BookingStatusEntry';
import { Op } from 'sequelize';
import { CapacityError, lockProjects, settleLinePartners, unitsUsed, type PartnerMove } from '@/utils/partnerCapacity';
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
        label: Joi.any()
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
    collectionDate: Joi.alternatives().conditional('paymentMethod.value', {
        is: Joi.valid('cheque', 'cash'),
        then: Joi.string()
            .pattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
            .required()
            .messages({
                "any.required": "Collection date is required when payment method is cheque or cash",
                "string.pattern.base": "Collection date must be in the format YYYY-MM-DDTHH:mm",
            }),
        otherwise: Joi.string().optional().allow(null, ''),
    }),
    collectionLocation: Joi.alternatives().conditional('paymentMethod.value', {
        is: Joi.valid('cheque', 'cash'),
        then: Joi.string().required().messages({
            "any.required": "Collection location is required when payment method is cheque or cash",
            "string.base": "Collection location is required",
        }),
        otherwise: Joi.string().optional().allow(null, '')
    }),
    idUserBanks: Joi.alternatives().conditional('paymentMethod.value', {
        is: Joi.valid('npsb', 'rtgs', 'beftn'),
        then: Joi.string().required().messages({
            "any.required": "User bank ID is required when payment method is npsb, rtgs, or beftn",
            "string.base": "User bank ID is required",
        }),
        otherwise: Joi.string().optional().allow(null, '')
    })
}).unknown();

export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
): Promise<void> {
    if (req.method === 'PUT') {
        let tokenData = req.headers.authorization;
        let token = tokenData?.split(' ')[1];

        if (!token || jwt.verify(token, JWT_SECRET) === null) {
            res.status(401).json({ success: false, message: 'Invalid token' });
            return;
        }

        let userInfo = jwt.decode(token) as JWTPayload;
        if (userInfo.userType !== 'admin') {
            res.status(403).json({ success: false, message: 'Access denied' });
            return;
        }

        const { bookingId, paymentMethod, paymentDate, paymentAmount, transactionId, collectionDate, collectionLocation, idUserBanks } = req.body;
        // Set when the admin accepted moving units off a partner who is full.
        const rebalance = req.body.rebalance === true;

        const options = {
            abortEarly: false,
        };

        const { error } = schema.validate({ bookingId, paymentMethod, paymentDate, paymentAmount, transactionId, collectionDate, collectionLocation, idUserBanks: String(idUserBanks) }, options);
        if (error) {
            let errorMessage: string[] = [];

            error.details.forEach((e) => {
                errorMessage.push(e.message);
            });
            return res.status(400).json({ success: false, message: errorMessage.join(". <br>") });
        }

        // Which projects this booking touches, read BEFORE the transaction.
        // Inside it, the project locks must come before any plain read: under
        // REPEATABLE READ the first plain read fixes the snapshot, so a sum
        // read after waiting for another confirmation's lock would not see
        // what that confirmation committed, and both could pass the limit.
        const found = await ProjectInvestmentBooking.findOne({ where: { bookingId }, attributes: ['idProjectInvestmentBookings'] });
        if (!found) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }
        const lineProjects = await ProjectInvestor.findAll({
            where: { idProjectInvestmentBookings: found.idProjectInvestmentBookings! },
            attributes: ['idProjects'],
        });

        const transaction = await sequelize.transaction();
        let committed = false;

        try {
            const booking = await ProjectInvestmentBooking.findOne({
                where: {
                    bookingId,
                },
                transaction,
                lock: transaction.LOCK.UPDATE,
            });

            if (!booking) {
                await transaction.rollback();
                return res.status(404).json({
                    success: false,
                    message: 'Booking not found',
                });
            }
            await lockProjects(lineProjects.map((line) => Number(line.idProjects)), transaction);

            // A reinvestment's amount is the whole booking: what was carried over
            // from the matured investment plus the top-up received. Typing only
            // the top-up here would understate the investment.
            const reinvested = Number((booking as any).reinvestedAmount) || 0;
            if ((booking as any).bookingType === 'reinvestment' && Number(paymentAmount) + 0.004 < reinvested) {
                await transaction.rollback();
                return res.status(400).json({
                    success: false,
                    message: `This is a reinvestment: enter the whole booking amount, BDT ${reinvested.toLocaleString('en-IN')} carried over plus the top-up received, not the top-up alone.`,
                });
            }

            // Two admins pressing confirm, or a cancelled booking, must not pass.
            if ((booking as any).cancelled === 'yes') {
                await transaction.rollback();
                return res.status(400).json({ success: false, message: 'This booking is cancelled.' });
            }
            if (booking.paymentConfirmationStatus === 'confirmed') {
                await transaction.rollback();
                return res.status(400).json({ success: false, message: 'This booking is already confirmed.' });
            }

            const investor = await User.findOne({
                where: { idUsers: booking.idUsers },
                transaction,
            });

            booking.paymentMethod = paymentMethod.value;
            booking.paymentDate = paymentDate;
            booking.paymentAmount = paymentAmount;
            booking.transactionId = transactionId;
            booking.paymentConfirmationStatus = 'confirmed';
            booking.collectionRequired = paymentMethod.value === 'cheque' || paymentMethod.value === 'cash' ? 'yes' : 'no';
            // A cheque or cash collection already marked "collected" stays collected:
            // confirming used to reset it to "pending", so a cheque picked up before
            // the funds cleared showed as still to collect after confirmation.
            booking.collectionStatus = paymentMethod.value === 'cheque' || paymentMethod.value === 'cash'
                ? (booking.collectionStatus === 'collected' ? 'collected' : 'pending')
                : null;
            const collectionDateTime = (paymentMethod.value === 'cheque' || paymentMethod.value === 'cash') && collectionDate ? new Date(collectionDate) : null;
            if (collectionDateTime) {
                collectionDateTime.setHours(collectionDateTime.getHours() + 12);
                booking.collectionDate = collectionDateTime.toISOString().replace('T', ' ').substring(0, 19);
            } else {
                booking.collectionDate = null;
            }
            booking.collectionLocation = (paymentMethod.value === 'cheque' || paymentMethod.value === 'cash') ? collectionLocation : null;

            await booking.save({ transaction });

            const projectInvestor = await ProjectInvestor.findAll({
                where: { idProjectInvestmentBookings: booking.idProjectInvestmentBookings! },
                transaction,
            });
            const moves: PartnerMove[] = [];
            // Units of this booking confirmed so far in this loop, per project.
            const confirmedHere = new Map<number, number>();

            for (const investor of projectInvestor) {
                // Only lines still waiting: one already cancelled stays cancelled.
                if (investor.investmentStatus !== 'booked') continue;

                const projectInfo = await Project.findOne({
                    where: {
                        idProjects: investor.idProjects,
                    },
                    attributes: ['totalAvailableUnits', 'investorUnitCapacity', 'projectName'],
                    transaction,
                });

                // Paid units plus the live holds of OTHER bookings: a booking
                // within its payment window always fits (its units were held
                // for it); one past its deadline needs genuinely free room.
                const idProjects = Number(investor.idProjects);
                if (projectInfo && Number(projectInfo.totalAvailableUnits) !== 0) {
                    const others = await unitsUsed({ idProjects, excludeBooking: booking.idProjectInvestmentBookings! }, transaction);
                    const total = Number(projectInfo.totalAvailableUnits);
                    const mine = (confirmedHere.get(idProjects) ?? 0) + Number(investor.unitPurchased);
                    if (others + mine > total) {
                        await transaction.rollback();
                        return res.status(400).json({
                            success: false,
                            code: 'PROJECT_CAPACITY',
                            message: `Total available units exceeded: ${projectInfo.projectName} has ${Math.max(0, total - others - (confirmedHere.get(idProjects) ?? 0))} unit(s) free for this booking (paid units and other bookings' holds count), and it needs ${Number(investor.unitPurchased)}.`,
                        });
                    }
                }

                /**
                 * Units this investor holds in the project RIGHT NOW, apart
                 * from the line being confirmed.
                 *
                 * This used to add up every line the investor had ever had in
                 * the project, whatever its status — cancelled bookings,
                 * investments already paid out, and investments rolled over
                 * into a new cycle all counted. Projects are reused across
                 * cycles, so a returning investor's history grew until it
                 * passed the cap by itself: someone holding 46 active units
                 * was refused a 40-unit booking against a cap of 200, because
                 * 146 units from finished cycles were still being counted.
                 *
                 * Only `confirmed` lines are money in the project today, which
                 * is the same definition the two checks around this one use
                 * (total units above, partner units below). Other bookings
                 * still waiting for confirmation are not counted: each is
                 * checked against the cap when its own turn comes.
                 */
                const activeUnits = await ProjectInvestor.sum('unitPurchased', {
                    where: {
                        idUsers: investor.idUsers,
                        idProjects: investor.idProjects,
                        investmentStatus: 'confirmed',
                        idProjectInvestors: {
                            [Op.not]: investor.idProjectInvestors
                        },
                    },
                    transaction,
                });

                // The old condition skipped the check entirely when the
                // investor had no other line, so a first booking larger than
                // the cap went straight through.
                //
                // 0 and NULL both mean "no per-investor limit": projects/create
                // stores NULL when the field is left empty, and a NULL compared
                // as a number is 0, which would refuse every confirmation.
                const investorCap = Number(projectInfo?.investorUnitCapacity) || 0;
                if (projectInfo && investorCap > 0) {
                    const held = Number(activeUnits) || 0;
                    const adding = Number(investor.unitPurchased);
                    if (held + adding > investorCap) {
                        await transaction.rollback();
                        return res.status(400).json({
                            success: false,
                            message: `Investor unit capacity exceeded: this investor holds ${held} active unit(s) in ${projectInfo.projectName}, and ${adding} more would pass the limit of ${investorCap} per investor.`,
                        });
                    }
                }

                const moved = await settleLinePartners(
                    {
                        idProjectInvestors: investor.idProjectInvestors!,
                        idProjects,
                        unitPurchased: Number(investor.unitPurchased),
                        idProjectInvestmentBookings: booking.idProjectInvestmentBookings!,
                    },
                    projectInfo?.projectName ?? 'This project',
                    rebalance,
                    transaction,
                );
                if (moved) moves.push(...moved);

                investor.investmentStatus = 'confirmed';
                await investor.save({ transaction });
                confirmedHere.set(idProjects, (confirmedHere.get(idProjects) ?? 0) + Number(investor.unitPurchased));

            }

            const bookingStatus = await BookingStatusEntry(
                'confirmed',
                booking.idProjectInvestmentBookings!,
                userInfo.idUsers,
                moves.length ? moves.map((m) => `${m.units} unit(s) moved from ${m.from} to ${m.to}`).join('; ').slice(0, 250) : '',
                transaction,
            );
            if (!bookingStatus) {
                throw new Error('Error updating booking status');
            }

            await transaction.commit();
            committed = true;

            // After the commit, so an investor is never told about a booking that rolled back.
            try {
                await generateNotification('booking_active', {
                    fullName: investor?.fullName,
                    bookingId: booking.bookingId,
                }, investor!);
            } catch (notifyError) {
                console.error('Booking confirmed, but its notification failed:', (notifyError as Error).message);
            }

            return res.status(200).json({
                success: true,
                data: booking,
                message: 'Booking confirmed successfully',
                moves,
            });
        } catch (err) {
            if (committed) return res.status(200).json({ success: true, message: 'Booking confirmed successfully' });
            await transaction.rollback();
            if (err instanceof CapacityError) {
                return res.status(err.status).json({ success: false, code: err.code, message: err.message, details: err.details });
            }
            return res.status(400).json({ success: false, message: (err as Error).message });
        }
    } else {
        res.status(405).json({ success: false, message: 'Method not allowed' });
    }
}
