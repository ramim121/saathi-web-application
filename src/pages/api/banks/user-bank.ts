import { NextApiRequest, NextApiResponse } from 'next';
import { Bank, UserBank, BankBranch } from '@/models/__associations';
import Cors from 'micro-cors';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '@/config/constants';
import JWTPayload from '@/types/JWTPayload';
import Joi from 'joi';
import sequelize from '@/config/db';
import { Op } from 'sequelize';
import _ from 'await-to-js';

const cors = Cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS', 'PUT'],
    allowHeaders: ['X-Requested-With', 'Authorization', 'Content-Type'],
});

const createSchema = Joi.object({
    idUsers: Joi.number().required().messages({
        "any.required": "Investor must be selected",
        "number.base": "Investor must be selected",
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
}).unknown();

const updateSchema = Joi.object({
    idUserBanks: Joi.number().required().messages({
        "any.required": "User bank must be selected",
        "number.base": "User bank must be selected",
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
    default: Joi.string().required().messages({
        "any.required": "Default status must be selected",
        "string.base": "Default status must be selected",
    }),
}).unknown();


async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'OPTIONS') { return res.status(200).end(); }
    console.log(req.body);

    let tokenData = req.headers.authorization;
    let token = tokenData?.split(' ')[1];

    if (!token) { res.status(401).json({ success: false, message: 'Token not found' }); return; }
    try { jwt.verify(token, JWT_SECRET); } catch (error: any) { return res.status(401).json({ success: false, message: error.message }); }

    let userInfo = jwt.decode(token) as JWTPayload;

    if (req.method === 'GET') {
        try {

            const result = await UserBank.findAll({
                where: { idUsers: userInfo.idUsers },
                include: [
                    {
                        model: Bank,
                    },
                    {
                        model: BankBranch,
                    }
                ],
                order: [['idUserBanks', 'DESC']]
            });
            return res.status(200).json({ success: true, data: result });
        } catch (error) {
            return res.status(500).json({ success: false, message: (error as Error).message })
        }
    } else if (req.method === 'POST') {
        const idUsers = userInfo.idUsers;
        const { idBanks, idBankBranches, accountHolderName, accountNumber } = req.body
        const options = {
            abortEarly: false,
        };
        const { error } = createSchema.validate({ idUsers, idBanks, idBankBranches, accountHolderName, accountNumber }, options);
        if (error) {
            let errorMessage: string[] = [];

            error.details.forEach((e) => {
                errorMessage.push(e.message);
            });
            return res.status(400).json({ success: false, message: errorMessage.join(". <br>") });
        }

        const userBankExist = await UserBank.findOne({
            where: {
                accountNumber,
                idUsers
            }
        });

        if (userBankExist) {
            return res.status(400).json({ success: false, message: 'Account number already exist' });
        }

        const transaction = await sequelize.transaction();

        try {
            const userBank = await UserBank.create({
                idUsers,
                idBanks: req.body.idBanks,
                idBankBranches: req.body.idBankBranches,
                accountNumber: req.body.accountNumber,
                accountHolderName: req.body.accountHolderName,
            }, { transaction });

            await transaction.commit();
            return res.status(200).json({ success: true, message: 'User bank created successfully', data: userBank })
        } catch (err) {
            await transaction.rollback();
            return res.status(500).json({ success: false, message: (err as Error).message })
        }
    } else if (req.method === 'PUT') {
        {
            const { idUserBanks, idBanks, idBankBranches, accountHolderName, accountNumber } = req.body
            const options = {
                abortEarly: false,
            };
            const { error } = updateSchema.validate({ idUserBanks, idBanks, idBankBranches, accountHolderName, accountNumber, default: req.body.default }, options);
            if (error) {
                let errorMessage: string[] = [];

                error.details.forEach((e) => {
                    errorMessage.push(e.message);
                });
                return res.status(400).json({ success: false, message: errorMessage.join(". <br>") });
            }

            const transaction = await sequelize.transaction();

            // Setting default to no for all user banks
            if (req.body.default === 'yes') {
                const [error3] = await _(UserBank.update({ default: 'no' }, { where: { idUsers: userInfo.idUsers }, transaction }));
                if (error3) {
                    await transaction.rollback();
                    return res.status(500).json({ success: false, message: error3.message })
                }
            }

            const userBank = await UserBank.findOne({
                where: {
                    idUserBanks, idUsers: userInfo.idUsers
                }, transaction
            });

            if (!userBank) {
                await transaction.rollback();
                return res.status(400).json({ success: false, message: 'User bank not found' })
            }

            userBank.idBanks = idBanks;
            userBank.idBankBranches = idBankBranches;
            userBank.accountHolderName = accountHolderName;
            userBank.accountNumber = accountNumber;
            userBank.default = req.body.default;

            const [error2] = await _(userBank.save({ transaction }));

            if (error2) {
                await transaction.rollback();
                return res.status(500).json({ success: false, message: error2.message })
            }

            await transaction.commit();
            return res.status(200).json({ success: true, message: 'User bank updated successfully', userBank })
        }
    } else {
        res.status(405).json({ success: false, message: 'Method not allowed' })
    }
}

export default cors(handler as any);