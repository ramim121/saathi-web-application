import { NextApiRequest, NextApiResponse } from 'next';
import Joi from 'joi';
import sequelize from '@/config/db';
import { ProjectInvestor, ProjectInvestmentBooking, ProjectInvestorStatus, UserBank, Bank } from '@/models/__associations';
import { withCors, requireUser, type AuthContext } from '@/utils/auth';
import ProjectInvestorStatusEntry from '@/utils/ProjectInvestorStatusEntry';

/**
 * POST /api/v2/investments/payout-request
 *
 * The investor says what to do with a matured investment line:
 *   - withdraw          → line becomes `request_withdrawal` (the enum value
 *                         existed but nothing ever wrote it); admins already
 *                         filter matured bookings on it.
 *   - reinvest_full     → reinvest capital and profit
 *   - reinvest_capital  → reinvest the capital, pay out the profit
 *
 * A reinvest request leaves the line at `ready_for_withdrawal`, because the
 * admin reinvestment routes only act on that status. Every request is written
 * to the line's status history (`project_investor_statuses`) with a plain
 * remark, so the admin sees it on the booking's Activity tab. The investor can
 * change their mind until an admin acts on it.
 *
 * Only the line's owner can ask, and only once the line is payout due.
 */
const CHOICES = ['withdraw', 'reinvest_full', 'reinvest_capital'] as const;
type Choice = (typeof CHOICES)[number];

const PAYOUT_REQUEST_STATUSES = ['request_withdrawal', 'reinvest_full_requested', 'reinvest_capital_requested'];

const schema = Joi.object({
    idProjectInvestors: Joi.number().integer().positive().required().messages({ 'any.required': 'Choose the investment' }),
    choice: Joi.string()
        .valid(...CHOICES)
        .required()
        .messages({ 'any.only': 'Choose withdraw or reinvest', 'any.required': 'Choose withdraw or reinvest' }),
});

const REMARK: Record<Exclude<Choice, 'withdraw'>, string> = {
    reinvest_full: 'Investor asked to reinvest the capital and the profit.',
    reinvest_capital: 'Investor asked to reinvest the capital and be paid the profit.',
};

const mask = (n: unknown) => {
    const s = String(n ?? '').replace(/\s/g, '');
    return s.length > 4 ? `··· ${s.slice(-4)}` : s;
};

async function handler(req: NextApiRequest, res: NextApiResponse, auth: AuthContext) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method not allowed' });
    }
    const { error, value } = schema.validate(req.body ?? {}, { abortEarly: false });
    if (error) {
        return res.status(400).json({ success: false, message: error.details.map((d) => d.message).join('. ') });
    }
    const { idProjectInvestors, choice } = value as { idProjectInvestors: number; choice: Choice };

    const line = await ProjectInvestor.findOne({
        where: { idProjectInvestors, idUsers: auth.idUsers },
        include: [ProjectInvestmentBooking],
    });
    if (!line) {
        return res.status(404).json({ success: false, message: 'Investment not found' });
    }
    const booking = (line as any).ProjectInvestmentBooking;
    if (booking?.cancelled === 'yes') {
        return res.status(400).json({ success: false, message: 'This booking was cancelled.' });
    }
    if (line.investmentStatus !== 'ready_for_withdrawal' && line.investmentStatus !== 'request_withdrawal') {
        return res.status(400).json({
            success: false,
            message: 'This investment is not due for payout yet. You can choose once DigiGram marks it as payout due.',
        });
    }

    let remark: string;
    let historyStatus: string;
    let lineStatus: 'ready_for_withdrawal' | 'request_withdrawal';
    if (choice === 'withdraw') {
        const bank =
            (await UserBank.findOne({ where: { idUsers: auth.idUsers, default: 'yes' }, include: [Bank] })) ??
            (await UserBank.findOne({ where: { idUsers: auth.idUsers }, include: [Bank], order: [['idUserBanks', 'DESC']] }));
        if (!bank) {
            return res.status(400).json({ success: false, message: 'Add a payout bank account first, so we know where to send the money.' });
        }
        const bankName = (bank as any).Bank?.bankNameFull || (bank as any).Bank?.bankName || 'bank account';
        remark = `Investor asked for the payout to ${bankName} ${mask(bank.accountNumber)}.`;
        historyStatus = 'request_withdrawal';
        lineStatus = 'request_withdrawal';
    } else {
        remark = REMARK[choice];
        historyStatus = `${choice}_requested`;
        lineStatus = 'ready_for_withdrawal';
    }

    // Asking the same thing twice changes nothing and adds no history.
    const latest = await ProjectInvestorStatus.findOne({
        where: { idProjectInvestors, status: PAYOUT_REQUEST_STATUSES },
        order: [['createdAt', 'DESC']],
    });
    if (latest && latest.status === historyStatus && line.investmentStatus === lineStatus) {
        return res.status(200).json({ success: true, message: 'Request already received', data: { choice, at: latest.createdAt } });
    }

    const transaction = await sequelize.transaction();
    try {
        line.investmentStatus = lineStatus;
        await line.save({ transaction });
        const entry = await ProjectInvestorStatusEntry(historyStatus, idProjectInvestors, auth.idUsers, remark, transaction);
        await transaction.commit();
        return res.status(200).json({ success: true, message: 'Request received', data: { choice, at: (entry as any)?.createdAt ?? new Date() } });
    } catch (err) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: (err as Error).message });
    }
}

export default withCors(requireUser(handler));
