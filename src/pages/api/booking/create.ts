import { NextApiRequest, NextApiResponse } from 'next';
import { ProjectInvestor, ProjectPartnerInvestor, UserBank } from '@/models/__associations';
import sequelize from '@/config/db';
import Joi from 'joi';

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
    branchName: Joi.string().required().messages({
        "any.required": "Branch name is required",
        "string.base": "Branch name can not be empty",
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'POST') {
        const { idUsers, investmentDate, projects, idBanks, branchName, accountHolderName, accountNumber } = req.body
        const options = {
            abortEarly: false,
        };
        const { error } = schema.validate({ idUsers, investmentDate, projects, idBanks, branchName, accountHolderName, accountNumber }, options);
        if (error) {
            let errorMessage: string[] = [];

            error.details.forEach((e) => {
                errorMessage.push(e.message);
            });
            return res.status(400).json({ success: false, message: errorMessage.join(". <br>") });
        }
        const transaction = await sequelize.transaction();

        try {
            for (const project of projects) {
                const projectInvestor = await ProjectInvestor.create({
                    idUsers,
                    idProjects: project.idProjects,
                    unitPurchased: project.unitPurchased,
                    investmentStatus: 'booked',
                    investmentDate,
                }, { transaction });

                for (const partner of project.projectPartners) {
                    const projectPartnerInvestor = await ProjectPartnerInvestor.create({
                        idProjectInvestors: projectInvestor.idProjectInvestors,
                        idProjectPartners: partner.idProjectPartners,
                        amountInvested: partner.amountInvested,
                    }, { transaction });
                }
            }

            const userBank = await UserBank.create({
                idUsers,
                idBanks: req.body.idBanks,
                branchName: req.body.branchName,
                accountNumber: req.body.accountNumber,
                accountHolderName: req.body.accountHolderName,
            }, { transaction });

            await transaction.commit();
            return res.status(200).json({ success: true, message: 'Investment booked successfully' })
        } catch (err) {
            await transaction.rollback();
            return res.status(500).json({ success: false, message: (err as Error).message })
        }
    } else {
        res.status(405).json({ success: false, message: 'Method not allowed' })
    }
}