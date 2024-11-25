import { NextApiRequest, NextApiResponse } from 'next';
import { ProjectInvestmentBooking, ProjectInvestor, ProjectPartnerInvestor, UserBank, User, Project } from '@/models/__associations';
import sequelize from '@/config/db';
import Joi from 'joi';
import Cors from 'micro-cors';

const cors = Cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS', 'PUT'],
    allowHeaders: ['X-Requested-With', 'Authorization', 'Content-Type'],
});

// export const config = {
//     api: {
//         bodyParser: false,
//     },
// };


const schema = Joi.object({
    idUsers: Joi.number().required().messages({
        "any.required": "Investor must be selected",
        "number.base": "Investor must be selected",
    }),
    investmentDate: Joi.date().required().messages({
        "any.required": "Investment date is required",
        "date.base": "Invalid date",
    }),
    idBanks: Joi.number().required().messages({
        "any.required": "Bank must be selected",
        "number.base": "Bank must be selected",
    }),
    idBankBranches: Joi.number().required().messages({
        "any.required": "Branch must be selected",
        "number.base": "Branch must be selected",
    }),
    accountNumber: Joi.string().required().messages({
        "any.required": "Account number is required",
        "string.base": "Account number can not be empty",
    }),
    accountHolderName: Joi.string().required().messages({
        "any.required": "Account holder name is required",
        "string.base": "Account holder name can not be empty",
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
        const { idUsers, investmentDate, projects, idBanks, idBankBranches, accountHolderName, accountNumber } = req.body
        const options = {
            abortEarly: false,
        };
        const { error } = schema.validate({ idUsers, investmentDate, projects, idBanks, idBankBranches, accountHolderName, accountNumber }, options);
        if (error) {
            let errorMessage: string[] = [];

            error.details.forEach((e) => {
                errorMessage.push(e.message);
            });
            return res.status(400).json({ success: false, message: errorMessage.join(". <br>") });
        }

        const userVerification = await User.findOne({
            where: {
                idUsers,
            }
        });

        if (!userVerification) {
            return res.status(404).json({ success: false, message: 'Investor not found' });
        }

        if (userVerification.emailVerified === 'no' && userVerification.phoneVerified === 'no') {
            return res.status(400).json({ success: false, message: 'Please verify your email or phone number before making any investment' });
        }

        // if () {
        //     return res.status(400).json({ success: false, message: 'Please verify your phone number before making any investment' });
        // }

        if (userVerification.nidVerified === 'no' || userVerification.nidVerified === null) {
            return res.status(400).json({ success: false, message: 'Please verify your NID before making any investment' });
        }

        const transaction = await sequelize.transaction();

        try {

            const userBankExist = await UserBank.findOne({
                where: {
                    idUsers,
                    accountNumber
                }
            });

            let userBankId = null;

            if (userBankExist) {
                userBankId = userBankExist.idUserBanks;
            }
            else {
                const userBank = await UserBank.create({
                    idUsers,
                    idBanks: req.body.idBanks,
                    idBankBranches: req.body.idBankBranches,
                    accountNumber: req.body.accountNumber,
                    accountHolderName: req.body.accountHolderName,
                }, { transaction });

                userBankId = userBank.idUserBanks;
            }

            const maximumBookingId = await ProjectInvestmentBooking.max('bookingId');
            const bookingId = (maximumBookingId ? parseInt(String(maximumBookingId)) + 1 : 1).toString().padStart(6, '0');

            const projectInvestmentBooking = await ProjectInvestmentBooking.create({
                idUsers,
                paymentMethod: 'bank',
                bookingId: bookingId,
                paymentConfirmationStatus: 'pending',
                idUserBanks: userBankId,
            }, { transaction });


            for (const project of projects) {
                const projectInfo = await Project.findOne({
                    where: {
                        idProjects: project.idProjects,
                    },
                    attributes: ['totalAvailableUnits', 'investorUnitCapacity',],
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
                        idUsers,
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
                    idUsers,
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
                    }, { transaction });
                }
            }

            await transaction.commit();
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