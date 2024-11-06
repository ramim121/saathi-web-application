import { NextApiRequest, NextApiResponse } from 'next';
import { UserBank } from '@/models/__associations';
import sequelize from '@/config/db';
import Joi from 'joi';
import Cors from 'micro-cors';
import { Op } from 'sequelize';

const cors = Cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS', 'PUT'],
    allowHeaders: ['X-Requested-With', 'Authorization', 'Content-Type'],
});


const schema = Joi.object({
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
}).unknown();

async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'OPTIONS') { return res.status(200).end(); }
    if (req.method === 'POST') {
        const { idBanks, branchName, accountHolderName, accountNumber } = req.body
        const options = {
            abortEarly: false,
        };
        const { error } = schema.validate({ idBanks, branchName, accountHolderName, accountNumber }, options);
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
                [Op.not]: {
                    idUserBanks: req.query.id
                }
            }
        });

        if (userBankExist) {
            return res.status(400).json({ success: false, message: 'Account number already exist' });
        }

        const transaction = await sequelize.transaction();

        try {
            const userBank = await UserBank.update({
                idBanks, branchName, accountHolderName, accountNumber
            }, {
                where: {
                    idUserBanks: req.query.id
                },
                transaction
            });

            await transaction.commit();
            return res.status(200).json({ success: true, message: 'Bank information updated successfully', data: userBank })
        } catch (err) {
            await transaction.rollback();
            return res.status(500).json({ success: false, message: (err as Error).message })
        }
    } else {
        res.status(405).json({ success: false, message: 'Method not allowed' })
    }
}

export default cors(handler as any);