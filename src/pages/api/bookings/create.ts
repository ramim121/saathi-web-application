import { NextApiRequest, NextApiResponse } from 'next';
import { ProjectInvestmentBooking, ProjectInvestor, ProjectPartnerInvestor, UserBank, User, Project } from '@/models/__associations';
import sequelize from '@/config/db';
import Joi from 'joi';
import Cors from 'micro-cors';
import { JWT_SECRET } from '@/config/constants';
import jwt from 'jsonwebtoken';
import JWTPayload from '@/types/JWTPayload';
import UserBankType from '@/types/UserBank';
import { createBank } from '../banks/user-bank';
import user from '../user';
import { generateNotification } from '@/notifications';

const cors = Cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS', 'PUT'],
    allowHeaders: ['X-Requested-With', 'Authorization', 'Content-Type'],
});

const schema = Joi.object({
    investmentDate: Joi.date().required().messages({
        "any.required": "Investment date is required",
        "date.base": "Invalid date",
    }),
    // idUserbanks: Joi.number().optional(),
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
                })
            ).required().messages({
                "any.required": "Project partner must be selected",
            }),
        })
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

        if (userVerification.nidVerified === 'no' || userVerification.nidVerified === null) {
            return res.status(400).json({ success: false, message: 'Please verify your NID before making any investment' });
        }

        const transaction = await sequelize.transaction();

        try {

            // let userBankData: any;

            // if (idUserBanks) {
            //     userBankData = await UserBank.findOne({ where: { idUserBanks: idUserBanks, idUsers: userInfo.idUsers } });
            //     if (!userBankData) {
            //         await transaction.rollback();
            //         return res.status(400).json({ success: false, message: 'User bank not found' });
            //     }
            // } else {
            //     userBankData = await createBank({ body: req.body.userBanks } as NextApiRequest, res, userInfo, transaction, false);

            //     if (typeof userBankData == 'string') {
            //         return res.status(400).json({ success: false, message: userBankData });
            //     }
            // }

            const maximumBookingId = await ProjectInvestmentBooking.max('bookingId');
            const bookingId = (maximumBookingId ? parseInt(String(maximumBookingId)) + 1 : 1).toString().padStart(6, '0');

            const projectInvestmentBooking = await ProjectInvestmentBooking.create({
                idUsers: userInfo.idUsers,
                // paymentMethod: 'bank',
                bookingId: bookingId,
                paymentConfirmationStatus: 'pending',
                // idUserBanks: userBankData.idUserBanks,
            }, { transaction });

            const projectForNotifications = [];
            for (const project of projects) {
                const projectInfo = await Project.findOne({
                    where: {
                        idProjects: project.idProjects,
                    },
                    attributes: ['totalAvailableUnits', 'investorUnitCapacity', 'projectName', 'duration', 'tenure', 'unitInvestmentValue'],
                });

                projectForNotifications.push({
                    projectName: projectInfo!.projectName,
                    duration: projectInfo!.duration,
                    tenure: projectInfo!.tenure,
                    unitInvestmentValue: projectInfo!.unitInvestmentValue,
                    unitPurchased: project.unitPurchased,
                });

                const alreadyPurchased = await ProjectInvestor.sum('unitPurchased', {
                    where: {
                        idProjects: project.idProjects,
                    }
                });

                if (projectInfo && projectInfo.totalAvailableUnits !== 0) {
                    if (Number(alreadyPurchased) + Number(project.unitPurchased) > projectInfo.totalAvailableUnits) {
                        await transaction.rollback();
                        return res.status(400).json({ success: false, message: 'Total available units excedded' });
                    }
                }

                const userBooking = await ProjectInvestor.sum('unitPurchased', {
                    where: {
                        idUsers: userInfo.idUsers,
                        idProjects: project.idProjects,
                    }
                });

                if (userBooking && userBooking > 0 && projectInfo && projectInfo.investorUnitCapacity !== 0) {
                    if (Number(userBooking) + Number(project.unitPurchased) > projectInfo.investorUnitCapacity) {
                        await transaction.rollback();
                        return res.status(400).json({ success: false, message: 'Investor unit capacity excedded' });
                    }
                }


                const projectInvestor = await ProjectInvestor.create({
                    idUsers: userInfo.idUsers,
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
            }

            await transaction.commit();

            let currentDate = new Date();
            await generateNotification('booking_placed', {
                fullName: userVerification.fullName,
                projects: projectForNotifications,
                bookingId: bookingId,
                lastDateToTransferFunds: currentDate,
            }, userVerification);

            return res.status(200).json({ success: true, message: 'Investment booked successfully', data: projectInvestmentBooking })
        } catch (err) {
            await transaction.rollback();
            return res.status(500).json({ success: false, message: (err as Error).message })
        }
    } else {
        res.status(405).json({ success: false, message: 'Method not allowed' })
    }
}

export default cors(handler as any);