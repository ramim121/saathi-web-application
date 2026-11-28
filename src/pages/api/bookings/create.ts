import { NextApiRequest, NextApiResponse } from 'next';
import { ProjectInvestmentBooking, ProjectInvestor, ProjectPartnerInvestor, ProjectSpecialBookingReq, User, Project } from '@/models/__associations';
import sequelize from '@/config/db';
import Joi from 'joi';
import Cors from 'micro-cors';
import { JWT_SECRET } from '@/config/constants';
import jwt from 'jsonwebtoken';
import JWTPayload from '@/types/JWTPayload';
import { generateNotification } from '@/notifications';
import BookingStatusEntry from '@/utils/BookingStatusEntry';
import { CapacityError, planBooking } from '@/utils/partnerCapacity';
import { newBookingDueDate } from '@/utils/bookingHolds';
import { formatDue } from '@/utils/bookingHoldsShared';
import { idempotencyKey, beginIdempotent, finishIdempotent, abandonIdempotent } from '@/utils/idempotency';

const cors = Cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS', 'PUT'],
    allowHeaders: ['X-Requested-With', 'Authorization', 'Content-Type', 'Idempotency-Key'],
});

const schema = Joi.object({
    investmentDate: Joi.date().required().messages({
        "any.required": "Investment date is required",
        "date.base": "Invalid date",
    }),
    projects: Joi.array().items(
        Joi.object({
            deliveryLocation: Joi.allow(),
            preferredColor: Joi.allow(),
            preferredProductPrice: Joi.allow(),
            additionalRequest: Joi.allow(),
            idProjects: Joi.number().required().messages({
                "any.required": "Project must be selected",
                "number.base": "Project must be selected",
            }),
            unitPurchased: Joi.number().integer().min(1).max(100000).required().messages({
                "any.required": "Unit purchased is required",
                "number.base": "Unit purchased can not be empty",
                "number.integer": "Units must be a whole number",
                "number.min": "Units must be at least 1",
            }),
            projectPartners: Joi.array().items(
                Joi.object({
                    idProjectPartners: Joi.number().required().messages({
                        "any.required": "Project partner must be selected",
                        "number.base": "Project partner must be selected",
                    }),
                    amountInvested: Joi.number().min(0).required().messages({
                        "any.required": "Amount invested is required",
                        "number.base": "Amount invested can not be empty",
                        "number.min": "Amount invested can not be less than 0",
                    }),
                    investedUnit: Joi.number().integer().min(1).required().messages({
                        "any.required": "Invested units is required",
                        "number.base": "Invested units can not be empty",
                        "number.min": "Invested units can not be less than 0",
                    }),
                })
            )
                // Optional, and only a hint. planBooking() allocates units to
                // partners on the server under a lock (least-loaded partner with
                // room) and uses this list only when it adds up and fits; an
                // empty or missing list simply means "server decides". The app's
                // own allocation loop could hang the phone when capacity ran
                // short, so new app builds stop sending it. Older builds still
                // send it, which keeps working.
                .optional(),
        })
    )
        // `.required()` alone accepts `[]`, which created a booking row with no
        // projects, no investors and a consumed booking number — a ghost record
        // that no screen can render and no admin can act on. At least one
        // project is what "a booking" means.
        .min(1)
        .required()
        .messages({
            "array.min": "Select at least one project",
            "any.required": "Select at least one project",
        }),
}).unknown();

async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'OPTIONS') { return res.status(200).end(); }
    if (req.method === 'POST') {

        let tokenData = req.headers.authorization;
        let token = tokenData?.split(' ')[1];

        if (!token) { res.status(401).json({ success: false, message: 'Token not found' }); return; }
        try { jwt.verify(token, JWT_SECRET); } catch (error: any) { return res.status(401).json({ success: false, message: error.message }); }

        let userInfo = jwt.decode(token) as JWTPayload;

        const { investmentDate, projects } = req.body
        const options = {
            abortEarly: false,
        };
        const { error } = schema.validate({ investmentDate, projects }, options);
        if (error) {
            let errorMessage: string[] = [];

            error.details.forEach((e) => {
                errorMessage.push(e.message);
            });
            return res.status(400).json({ success: false, message: errorMessage.join(". <br>") });
        }

        const userVerification = await User.findOne({
            where: {
                idUsers: userInfo.idUsers,
            }
        });

        if (!userVerification) {
            return res.status(400).json({ success: false, message: 'Investor not found' });
        }

        if (userVerification.emailVerified === 'no' && userVerification.phoneVerified === 'no') {
            return res.status(400).json({ success: false, message: 'Please verify your email or phone number before making any investment' });
        }

        /**
         * NID approval is NOT required to book.
         *
         * A check here refused any account whose NID an admin had not approved.
         * It was removed on 2026-11-13 as a product decision: a verified phone
         * or email (above) is the only eligibility rule.
         *
         * Nothing else about NID changed. Investors still upload it
         * (api/profile/nid), admins still approve or reject it (api/verify),
         * and the result is still stored on the user. It just no longer stands
         * between an investor and a booking.
         */

        // A repeated tap or retry with the same Idempotency-Key gets the first
        // answer instead of a second booking (see utils/idempotency.ts).
        const idemKey = idempotencyKey(req, 'bookings/create', userInfo.idUsers);
        if (idemKey) {
            const start = beginIdempotent(idemKey);
            if (start.kind === 'in-flight') {
                return res.status(409).json({ success: false, code: 'DUPLICATE_REQUEST', message: 'This booking is already being placed. Please wait a moment.' });
            }
            if (start.kind === 'replay') {
                return res.status(start.status).json(start.body);
            }
        }

        let transaction: Awaited<ReturnType<typeof sequelize.transaction>>;
        try {
            transaction = await sequelize.transaction();
        } catch (err) {
            abandonIdempotent(idemKey);
            return res.status(503).json({ success: false, message: 'The server is busy. Please try again in a moment.' });
        }
        let committed = false;
        let projectInvestmentBooking: any = null;

        try {

            // Limits and partners are settled first, under a lock on the projects.
            const planned = await planBooking(projects, userInfo.idUsers, transaction);

            const maximumBookingId = await ProjectInvestmentBooking.max('bookingId', { transaction });
            const bookingId = (maximumBookingId ? parseInt(String(maximumBookingId)) + 1 : 1).toString().padStart(6, '0');

            // Units are held until the end of the Nth day, Dhaka time; an
            // unpaid booking is cancelled after that (utils/bookingHolds.ts).
            const paymentDueAt = newBookingDueDate();
            projectInvestmentBooking = await ProjectInvestmentBooking.create({
                idUsers: userInfo.idUsers,
                bookingId: bookingId,
                paymentConfirmationStatus: 'pending',
                paymentDueAt,
            }, { transaction });

            const projectForNotifications = [];
            let totalAmount = 0;
            for (const [lineIndex, project] of projects.entries()) {
                const projectInfo = await Project.findOne({
                    where: {
                        idProjects: project.idProjects,
                    },
                    attributes: ['totalAvailableUnits', 'investorUnitCapacity', 'projectName', 'duration', 'tenure', 'unitInvestmentValue', 'projectType'],
                    transaction,
                });

                projectForNotifications.push({
                    projectName: projectInfo!.projectName,
                    duration: projectInfo!.duration,
                    tenure: projectInfo!.tenure,
                    unitInvestmentValue: projectInfo!.unitInvestmentValue,
                    unitPurchased: project.unitPurchased,
                });
                totalAmount += Number(projectInfo!.unitInvestmentValue || 0) * Number(project.unitPurchased || 0);

                const projectInvestor = await ProjectInvestor.create({
                    idUsers: userInfo.idUsers,
                    idProjects: project.idProjects,
                    unitPurchased: project.unitPurchased,
                    investmentStatus: 'booked',
                    investmentDate,
                    idProjectInvestmentBookings: projectInvestmentBooking.idProjectInvestmentBookings
                }, { transaction });

                for (const partner of planned[lineIndex].allocations) {
                    await ProjectPartnerInvestor.create({
                        idProjectInvestors: projectInvestor.idProjectInvestors,
                        idProjectPartners: partner.idProjectPartners,
                        amountInvested: partner.amountInvested,
                        investedUnit: partner.investedUnit,
                    }, { transaction });
                }

                if (projectInfo!.projectType === 'special') {
                    const specialBooking = await ProjectSpecialBookingReq.create({
                        idProjectInvestors: projectInvestor.idProjectInvestors,
                        deliveryLocation: project.deliveryLocation || null,
                        preferredColor: project.preferredColor || null,
                        preferredProductPrice: project.preferredProductPrice || null,
                        additionalRequest: project.additionalRequest || null,
                    }, { transaction });
                }
            }

            const bookingStatus = await BookingStatusEntry('placed', projectInvestmentBooking.idProjectInvestmentBookings!, userInfo.idUsers, '', transaction);
            if (!bookingStatus) {
                throw new Error('Error in booking placed');
            }

            await transaction.commit();
            committed = true;

            const due = projectInvestmentBooking.paymentDueAt as Date;
            await generateNotification('booking_placed', {
                fullName: userVerification.fullName,
                projects: projectForNotifications,
                bookingId: bookingId,
                totalAmount,
                // The real deadline (this used to be the time of booking).
                lastDateToTransferFunds: due,
                paymentDueAt: due.toISOString(),
                dueText: formatDue(due),
            }, userVerification);

            const okBody = { success: true, message: 'Investment booked successfully', data: projectInvestmentBooking };
            finishIdempotent(idemKey, 200, okBody);
            return res.status(200).json(okBody)
        } catch (err) {
            // The booking exists once committed: a failed notification must not report it as failed.
            if (committed) {
                console.error('Booking placed, but its notification failed:', (err as Error).message);
                const okBody = { success: true, message: 'Investment booked successfully', data: projectInvestmentBooking };
                finishIdempotent(idemKey, 200, okBody);
                return res.status(200).json(okBody);
            }
            abandonIdempotent(idemKey);
            await transaction.rollback();
            const status = err instanceof CapacityError ? err.status : 400;
            return res.status(status).json({ success: false, code: err instanceof CapacityError ? err.code : undefined, message: (err as Error).message })
        }
    } else {
        res.status(405).json({ success: false, message: 'Method not allowed' })
    }
}

export default cors(handler as any);