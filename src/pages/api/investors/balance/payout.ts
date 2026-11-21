import type { NextApiRequest, NextApiResponse } from 'next';
import Joi from 'joi';
import sequelize from '@/config/db';
import { InvestorBalanceEntry, User } from '@/models/__associations';
import { requireAdmin, withCors, type AuthContext } from '@/utils/auth';
import { balanceOf } from '@/utils/reinvestmentServer';

/**
 * POST { idUsers, amount, note }: record that money held for an investor was
 * paid to them. Cannot pay out more than the balance. Admins only.
 */
const schema = Joi.object({
    idUsers: Joi.number().integer().positive().required(),
    amount: Joi.number().greater(0).precision(2).required().messages({ 'number.greater': 'Enter the amount paid' }),
    note: Joi.string().trim().max(200).required().messages({ 'string.empty': 'Say how it was paid (bank transfer reference, cheque number…)', 'any.required': 'Say how it was paid (bank transfer reference, cheque number…)' }),
});

async function handler(req: NextApiRequest, res: NextApiResponse, auth: AuthContext) {
    if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });
    const { error, value } = schema.validate(req.body ?? {}, { abortEarly: false });
    if (error) return res.status(400).json({ success: false, message: error.details.map((d) => d.message).join('. <br>') });

    const transaction = await sequelize.transaction();
    try {
        // Serialise payouts per investor: lock their user row while checking the balance.
        const user = await User.findByPk(value.idUsers, { transaction, lock: transaction.LOCK.UPDATE, attributes: ['idUsers'] });
        if (!user) throw Object.assign(new Error('Investor not found'), { status: 404 });
        const balance = await balanceOf(value.idUsers, transaction);
        if (value.amount > balance + 0.004) throw Object.assign(new Error(`Only BDT ${balance.toLocaleString('en-IN')} is held for this investor.`), { status: 400 });
        await InvestorBalanceEntry.create({
            idUsers: value.idUsers,
            amount: -value.amount,
            entryType: 'paid_out',
            note: value.note,
            createdBy: auth.idUsers,
        }, { transaction });
        await transaction.commit();
        return res.status(200).json({ success: true, message: 'Payout recorded', data: { balance: Math.round((balance - value.amount) * 100) / 100 } });
    } catch (err) {
        await transaction.rollback().catch(() => undefined);
        return res.status((err as any).status || 400).json({ success: false, message: (err as Error).message });
    }
}

export default withCors(requireAdmin(handler));
