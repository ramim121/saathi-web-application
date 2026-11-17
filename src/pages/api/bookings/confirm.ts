import { NextApiRequest, NextApiResponse } from 'next';
import { ProjectInvestmentBooking, User, ProjectInvestor, Project, ProjectPartnerInvestor, ProjectPartner } from '@/models/__associations';
import Joi from 'joi';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '@/config/constants';
import JWTPayload from '@/types/JWTPayload';
import { generateNotification } from '@/notifications';
import sequelize from '@/config/db';
import BookingStatusEntry from '@/utils/BookingStatusEntry';
import { Op } from 'sequelize';
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

        const transaction = await sequelize.transaction();

        try {
            const booking = await ProjectInvestmentBooking.findOne({
                where: {
                    bookingId,
                },
                transaction,
            });

            if (!booking) {
                await transaction.rollback();
                return res.status(404).json({
                    success: false,
                    message: 'Booking not found',
                });
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
            booking.collectionStatus = paymentMethod.value === 'cheque' || paymentMethod.value === 'cash' ? 'pending' : null;
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

            for (const investor of projectInvestor) {

                const alreadyPurchased = await ProjectInvestor.sum('unitPurchased', {
                    where: {
                        idProjects: investor.idProjects,
                        investmentStatus: 'confirmed'
                    }
                });

                const projectInfo = await Project.findOne({
                    where: {
                        idProjects: investor.idProjects,
                    },
                    attributes: ['totalAvailableUnits', 'investorUnitCapacity', 'projectName'],
                });

                if (projectInfo && projectInfo.totalAvailableUnits !== 0) {
                    if (Number(alreadyPurchased) + Number(investor.unitPurchased) > projectInfo.totalAvailableUnits) {
                        await transaction.rollback();
                        return res.status(400).json({ success: false, message: 'Total available units excedded' });
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
                    }
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

                const projectPartnerInvestor = await ProjectPartnerInvestor.findAll({
                    where: {
                        idProjectInvestors: investor.idProjectInvestors,
                    },
                    transaction,
                });

                for (const partner of projectPartnerInvestor) {

                    const partnerInfo = await ProjectPartner.findOne({
                        where: {
                            idProjectPartners: partner.idProjectPartners,
                        },
                        attributes: ['partnerUnitCapacity'],
                    });

                    const alreadyInvested = await ProjectPartnerInvestor.sum('investedUnit', {
                        where: {
                            idProjectPartners: partner.idProjectPartners,
                            idProjectPartnerInvestors: {
                                [Op.not]: partner.idProjectPartnerInvestors
                            },
                            idProjectInvestors: {
                                [Op.in]: sequelize.literal(`(SELECT id_project_investors FROM project_investors WHERE investment_status = 'confirmed')`)
                            }
                        }
                    });

                    if (partnerInfo && partnerInfo.partnerUnitCapacity !== 0) {
                        if (Number(alreadyInvested) + Number(partner.investedUnit) > partnerInfo.partnerUnitCapacity) {
                            await transaction.rollback();
                            return res.status(400).json({ success: false, message: 'Partner unit capacity excedded' });
                        }
                    }
                }


                investor.investmentStatus = 'confirmed';
                await investor.save({ transaction });

            }

            await generateNotification('booking_active', {
                fullName: investor?.fullName,
                bookingId: booking.bookingId,
            }, investor!);

            const bookingStatus = await BookingStatusEntry('confirmed', booking.idProjectInvestmentBookings!, userInfo.idUsers, '', transaction);
            if (!bookingStatus) {
                await transaction.rollback();
                throw new Error('Error updating booking status');
            }

            await transaction.commit();

            return res.status(200).json({
                success: true,
                data: booking,
                message: 'Booking confirmed successfully',
            });
        } catch (err) {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: (err as Error).message });
        }
    } else {
        res.status(405).json({ success: false, message: 'Method not allowed' });
    }
}
