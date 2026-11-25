import { NextApiRequest, NextApiResponse } from 'next';
import { Bank, UserBank, BankBranch, ProjectInvestor } from '@/models/__associations';
import Cors from 'micro-cors';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '@/config/constants';
import JWTPayload from '@/types/JWTPayload';
import Joi from 'joi';
import sequelize from '@/config/db';
import { Op, Transaction } from 'sequelize';
import _ from 'await-to-js';
import userBankType from '@/types/UserBank';

const cors = Cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE'],
    allowHeaders: ['X-Requested-With', 'Authorization', 'Content-Type'],
});

const createSchema = Joi.object({
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
            return res.status(400).json({ success: false, message: (error as Error).message })
        }
    } else if (req.method === 'POST') {
        createBank(req, res, userInfo);
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
                    return res.status(400).json({ success: false, message: error3.message })
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
                return res.status(400).json({ success: false, message: error2.message })
            }

            await transaction.commit();
            return res.status(200).json({ success: true, message: 'User bank updated successfully', userBank });
        }
    } else if (req.method === 'DELETE') {
        return removeBank(req, res, userInfo);
    } else {
        res.status(405).json({ success: false, message: 'Method not allowed' })
    }
}

export default cors(handler as any);


export async function createBank(req: NextApiRequest, res: NextApiResponse, userInfo: JWTPayload, transactionMain?: Transaction, sendResponse = true): Promise<userBankType | string | undefined> {
    const idUsers = userInfo.idUsers;
    const options = {
        abortEarly: false,
    };
    const { error } = createSchema.validate(req.body, options);
    if (error) {
        let errorMessage: string[] = [];

        error.details.forEach((e) => {
            errorMessage.push(e.message);
        });
        if (sendResponse) { res.status(400).json({ success: false, message: errorMessage.join(". <br>") }); return; }
        return errorMessage.join(". <br>");
    }

    // Unscoped: a removed account (migration 015) still holds its row, and
    // account_number is unique. Adding it again brings that row back.
    const userBankExist = await UserBank.unscoped().findOne({
        where: {
            accountNumber: req.body.accountNumber,
            idUsers
        }
    });

    if (userBankExist && userBankExist.status !== 'removed') {
        if (sendResponse) { res.status(400).json({ success: false, message: 'Account number already exist' }); return; }
        return 'Account number already exist';
    }

    if (userBankExist) {
        const transaction = transactionMain || await sequelize.transaction();
        try {
            if (req.body.default === 'yes') {
                await UserBank.update({ default: 'no' }, { where: { idUsers }, transaction });
            }
            userBankExist.idBanks = req.body.idBanks;
            userBankExist.idBankBranches = req.body.idBankBranches;
            userBankExist.accountHolderName = req.body.accountHolderName;
            userBankExist.default = req.body.default;
            userBankExist.status = 'active';
            await userBankExist.save({ transaction });
            if (!transactionMain) await transaction.commit();
            if (sendResponse) { res.status(200).json({ success: true, message: 'User bank created successfully', data: userBankExist }); return; }
            return userBankExist as userBankType;
        } catch (err) {
            if (!transactionMain) await transaction.rollback();
            if (sendResponse) { res.status(400).json({ success: false, message: (err as Error).message }); return; }
            return (err as Error).message;
        }
    }

    const previousUserBank = await UserBank.findAll({ where: { idUsers } });

    const transaction = transactionMain || await sequelize.transaction();

    try {
        if (req.body.default === 'yes') {
            // Was missing `await` — the clear-other-defaults update raced the create
            // below, so adding a new default account could leave two rows flagged
            // `default: 'yes'`. The PUT branch above already awaits the same call.
            await UserBank.update({ default: 'no' }, { where: { idUsers }, transaction });
        }

        const userBank = await UserBank.create({
            idUsers,
            idBanks: req.body.idBanks,
            idBankBranches: req.body.idBankBranches,
            accountNumber: req.body.accountNumber,
            accountHolderName: req.body.accountHolderName,
            default: req.body.default,
        }, { transaction });



        if (!transactionMain) await transaction.commit();
        if (sendResponse) { res.status(200).json({ success: true, message: 'User bank created successfully', data: userBank }); return; }
        return userBank as userBankType;
    } catch (err) {
        await transaction.rollback();
        if (sendResponse) { res.status(400).json({ success: false, message: (err as Error).message }); return; }
        return (err as Error).message;
    }
}


/**
 * DELETE /api/banks/user-bank?idUserBanks=…  — the investor removes one of
 * their payout accounts.
 *
 * The row is marked 'removed', not deleted: bookings record the account they
 * were paid from (see migration 015). If it was the default, the newest
 * remaining account becomes the default. The last account cannot be removed
 * while an investment is still running or a payout is due, because the payout
 * would have nowhere to go.
 */
async function removeBank(req: NextApiRequest, res: NextApiResponse, userInfo: JWTPayload) {
    const raw = (req.query.idUserBanks ?? (req.body && req.body.idUserBanks)) as string | number | undefined;
    const idUserBanks = Number(raw);
    if (!Number.isInteger(idUserBanks) || idUserBanks <= 0) {
        return res.status(400).json({ success: false, message: 'Choose the bank account to remove' });
    }
    const idUsers = userInfo.idUsers;

    const bank = await UserBank.findOne({ where: { idUserBanks, idUsers } });
    if (!bank) {
        return res.status(404).json({ success: false, message: 'Bank account not found' });
    }

    const others = await UserBank.findAll({
        where: { idUsers, idUserBanks: { [Op.ne]: idUserBanks } },
        order: [['idUserBanks', 'DESC']],
    });

    if (!others.length) {
        const owed = await ProjectInvestor.count({
            where: { idUsers, investmentStatus: ['confirmed', 'ready_for_withdrawal', 'request_withdrawal'] },
        });
        if (owed > 0) {
            return res.status(400).json({
                success: false,
                message: 'Add another bank account first. Your running investments are paid out to this one.',
            });
        }
    }

    const transaction = await sequelize.transaction();
    try {
        const wasDefault = bank.default === 'yes';
        bank.status = 'removed';
        bank.default = 'no';
        await bank.save({ transaction });

        let newDefault: number | null = null;
        if (wasDefault && others.length && !others.some((b) => b.default === 'yes')) {
            others[0].default = 'yes';
            await others[0].save({ transaction });
            newDefault = others[0].idUserBanks ?? null;
        }

        await transaction.commit();
        return res.status(200).json({ success: true, message: 'Bank account removed', newDefault });
    } catch (err) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: (err as Error).message });
    }
}
