import { NextApiRequest, NextApiResponse } from 'next';
import { UserBank } from '@/models/__associations';
import sequelize from '@/config/db';
import Joi from 'joi';
import { Op } from 'sequelize';
import { withCors, requireUser, canAccess, type AuthContext } from '@/utils/auth';

/**
 * Update a user's bank account.
 *
 * SECURITY: this route previously had no authentication and no ownership check.
 * It took `idUserBanks` straight from the URL and wrote the account number into
 * that row, from any origin. `user_banks` is where investor returns are paid,
 * so anyone iterating integer IDs could redirect payouts.
 *
 * It now requires a valid token AND that the row belongs to the caller (admins
 * may act on any row).
 */

const schema = Joi.object({
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

async function handler(req: NextApiRequest, res: NextApiResponse, auth: AuthContext) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

    const { idBanks, idBankBranches, accountHolderName, accountNumber } = req.body;

    const { error } = schema.validate(
        { idBanks, idBankBranches, accountHolderName, accountNumber },
        { abortEarly: false },
    );
    if (error) {
        const errorMessage = error.details.map((e) => e.message);
        return res.status(400).json({ success: false, message: errorMessage.join(". <br>") });
    }

    // The row must exist AND belong to the caller before anything is written.
    const existing = await UserBank.findOne({ where: { idUserBanks: req.query.id } });
    if (!existing) {
        return res.status(404).json({ success: false, message: 'Bank account not found' });
    }
    if (!canAccess(auth, (existing as unknown as { idUsers: number }).idUsers)) {
        return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const userBankExist = await UserBank.findOne({
        where: {
            accountNumber,
            [Op.not]: { idUserBanks: req.query.id },
        },
    });
    if (userBankExist) {
        return res.status(400).json({ success: false, message: 'Account number already exist' });
    }

    const transaction = await sequelize.transaction();
    try {
        const userBank = await UserBank.update(
            { idBanks, idBankBranches, accountHolderName, accountNumber },
            { where: { idUserBanks: req.query.id }, transaction },
        );
        await transaction.commit();
        return res
            .status(200)
            .json({ success: true, message: 'Bank information updated successfully', data: userBank });
    } catch (err) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: (err as Error).message });
    }
}

export default withCors(requireUser(handler));
