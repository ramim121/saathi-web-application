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

const cors = Cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS', 'PUT'],
    allowHeaders: ['X-Requested-With', 'Authorization', 'Content-Type'],
});

const schema = Joi.object({
    investor: Joi.object({
        idUsers: Joi.number().required().messages({
            "any.required": "Investor ID is required",
            "number.base": "Investor ID must be a number",
        }),
    }).unknown().required(),
    investmentDate: Joi.date().required().messages({
        "any.required": "Investment date is required",
        "date.base": "Invalid date",
    }),
    projects: Joi.array().items(
        Joi.object({
            idProjects: Joi.number().required().messages({
                "any.required": "Project must be selected",
                "number.base": "Project must be selected",
            }),
            unitPurchased: Joi.number().required().messages({
                "any.required": "Unit purchased is required",
                "number.base": "Unit purchased can not be empty",
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
                    investedUnit: Joi.number().min(1).required().messages({
                        "any.required": "Invested units is required",
                        "number.base": "Invested units can not be empty",
                        "number.min": "Invested units can not be less than 0",
                    }),
                }).unknown()
            ).required().messages({
                "any.required": "Project partner must be selected",
            }),
        }).unknown()
    ).required(),
}).unknown();

async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'OPTIONS') { return res.status(200).end(); }
    if (req.method === 'POST') {

        let tokenData = req.headers.authorization;
        let token = tokenData?.split(' ')[1];

        if (!token) { res.status(401).json({ success: false, message: 'Token not found' }); return; }
        try { jwt.verify(token, JWT_SECRET); } catch (error: any) { return res.status(401).json({ success: false, message: error.message }); }

        let userInfo = jwt.decode(token) as JWTPayload;
        if (userInfo.userType !== 'admin') { res.status(403).json({ success: false, message: 'Access denied' }); return; }

        const { investmentDate, investor, projects } = req.body
        const options = {
            abortEarly: false,
        };
        const { error } = schema.validate({ investmentDate, investor, projects }, options);
        if (error) {
            let errorMessage: string[] = [];

            error.details.forEach((e) => {
                errorMessage.push(e.message);
            });
            return res.status(400).json({ success: false, message: errorMessage.join(". <br>") });
        }

        const investorVerification = await User.findOne({
            where: {
                idUsers: investor.idUsers,
            }
        });

        if (!investorVerification) {
            return res.status(400).json({ success: false, message: 'Investor not found' });
        }

        if (investorVerification.emailVerified === 'no' && investorVerification.phoneVerified === 'no') {
            return res.status(400).json({ success: false, message: "Please verify investor's email or phone number before making any investment" });
        }

        const transaction = await sequelize.transaction();

        try {

            const maximumBookingId = await ProjectInvestmentBooking.max('bookingId');
            const bookingId = (maximumBookingId ? parseInt(String(maximumBookingId)) + 1 : 1).toString().padStart(6, '0');

            const projectInvestmentBooking = await ProjectInvestmentBooking.create({
                idUsers: investorVerification.idUsers,
                bookingId: bookingId,
                paymentConfirmationStatus: 'pending',
            }, { transaction });

            const projectForNotifications = [];
            for (const project of projects) {
                const projectInfo = await Project.findOne({
                    where: {
                        idProjects: project.idProjects,
                    },
                    attributes: ['totalAvailableUnits', 'investorUnitCapacity', 'projectName', 'duration', 'tenure', 'unitInvestmentValue', 'projectType'],
                });

                projectForNotifications.push({
                    projectName: projectInfo!.projectName,
                    duration: projectInfo!.duration,
                    tenure: projectInfo!.tenure,
                    unitInvestmentValue: projectInfo!.unitInvestmentValue,
                    unitPurchased: project.unitPurchased,
                });

                const projectInvestor = await ProjectInvestor.create({
                    idUsers: investorVerification.idUsers,
                    idProjects: project.idProjects,
                    unitPurchased: project.unitPurchased,
                    investmentStatus: 'booked',
                    investmentDate,
                    idProjectInvestmentBookings: projectInvestmentBooking.idProjectInvestmentBookings
                }, { transaction });

                for (const partner of project.projectPartners) {
                    const projectPartnerInvestor = await ProjectPartnerInvestor.create({
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

            const bookingStatus = await BookingStatusEntry('placed', projectInvestmentBooking.idProjectInvestmentBookings!, investorVerification.idUsers!, '', transaction);
            if (!bookingStatus) {
                await transaction.rollback();
                throw new Error('Error in booking placed');
            }

            await transaction.commit();

            let currentDate = new Date();
            await generateNotification('booking_placed', {
                fullName: investorVerification.fullName,
                projects: projectForNotifications,
                bookingId: bookingId,
                lastDateToTransferFunds: currentDate,
            }, investorVerification);

            return res.status(200).json({ success: true, message: 'Investment booked successfully', data: projectInvestmentBooking })
        } catch (err) {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: (err as Error).message })
        }
    } else {
        res.status(405).json({ success: false, message: 'Method not allowed' })
    }
}

export default cors(handler as any);