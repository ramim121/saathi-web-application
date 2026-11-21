import type { NextApiRequest, NextApiResponse } from 'next';
import Joi from 'joi';
import sequelize from '@/config/db';
import { InvestorBalanceEntry, Project, ProjectInvestmentBooking, ProjectInvestor, ProjectPartnerInvestor, User } from '@/models/__associations';
import { requireAdmin, withCors, type AuthContext } from '@/utils/auth';
import BookingStatusEntry from '@/utils/BookingStatusEntry';
import ProjectInvestorStatusEntry from '@/utils/ProjectInvestorStatusEntry';
import { generateNotification } from '@/notifications';
import { addTerm, planReinvestment, REINVEST_MODES, type ReinvestMode } from '@/utils/reinvestment';
import { balanceOf, capacityProblem, loadReinvestSource, nextBookingRef } from '@/utils/reinvestmentServer';
import { lockProjects } from '@/utils/partnerCapacity';

/**
 * POST: reinvest a matured investment line into a new booking on the
 * investor's account (see src/utils/reinvestment.ts for the three modes).
 *
 * - No top-up: the new booking is confirmed at once and starts on `startDate`.
 * - Top-up: the new booking waits as `pending` with the top-up as the money to
 *   pay. It shows in the app under pending proof of payment; the investor (or
 *   an admin) uploads the proof, and confirming it sets the payment date,
 *   which starts the investment.
 * - Money not reinvested (profit in capital-only, what does not make a whole
 *   unit) is recorded in the investor's balance (investor_balance_entries).
 *
 * Everything is one transaction; the investor is notified after it commits.
 * Supersedes PUT api/bookings/reinvest (kept unchanged for any old caller).
 */

const schema = Joi.object({
    idProjectInvestors: Joi.number().integer().positive().required(),
    mode: Joi.string().valid(...REINVEST_MODES).required(),
    profitAmount: Joi.number().min(0).required().messages({ 'number.min': 'Profit cannot be negative', 'any.required': 'Enter the actual profit' }),
    profitPercentage: Joi.number().min(0).allow(null),
    idProjects: Joi.number().integer().positive().required().messages({ 'any.required': 'Choose a project' }),
    units: Joi.number().integer().min(1).required(),
    idProjectPartners: Joi.number().integer().positive().required().messages({ 'any.required': 'Choose a partner' }),
    useBalance: Joi.boolean().default(false),
    startDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).allow(null, ''),
    payoutDoneNow: Joi.boolean().default(false),
    notify: Joi.boolean().default(true),
});

const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');
const todayUtc = () => new Date().toISOString().slice(0, 10);

async function handler(req: NextApiRequest, res: NextApiResponse, auth: AuthContext) {
    if (req.method !== 'POST') return res.status(405).json({ success: false, message: 'Method not allowed' });
    const { error, value } = schema.validate(req.body ?? {}, { abortEarly: false });
    if (error) return res.status(400).json({ success: false, message: error.details.map((d) => d.message).join('. <br>') });
    const input = value as {
        idProjectInvestors: number; mode: ReinvestMode; profitAmount: number; profitPercentage: number | null;
        idProjects: number; units: number; idProjectPartners: number; useBalance: boolean; startDate: string | null;
        payoutDoneNow: boolean; notify: boolean;
    };

    const transaction = await sequelize.transaction();
    let outcome: any = null;
    try {
        // Lock the matured line: two admins must not reinvest it twice.
        await ProjectInvestor.findByPk(input.idProjectInvestors, { transaction, lock: transaction.LOCK.UPDATE });
        const source = await loadReinvestSource(input.idProjectInvestors, transaction);
        if (!source) throw Object.assign(new Error('Investment not found'), { status: 404 });
        if (!source.eligible) throw Object.assign(new Error(source.reason || 'This investment cannot be reinvested'), { status: 400 });

        const target = await Project.findByPk(input.idProjects, { transaction });
        if (!target) throw Object.assign(new Error('Project not found'), { status: 404 });
        const t = target as any;
        const unitValue = Number(t.unitInvestmentValue) || 0;
        const idUsers = source.line.idUsers;
        const balance = await balanceOf(idUsers, transaction);
        const plan = planReinvestment({
            mode: input.mode, capital: source.capital, profit: input.profitAmount, balance, useBalance: input.useBalance, unitValue, units: input.units,
        });
        if (plan.problem) throw Object.assign(new Error(plan.problem), { status: 400 });
        await lockProjects([input.idProjects], transaction);
        const capacity = await capacityProblem({ idProjects: input.idProjects, idProjectPartners: input.idProjectPartners, idUsers, units: input.units, leavingLine: input.idProjectInvestors }, transaction);
        if (capacity) throw Object.assign(new Error(capacity), { status: 400 });

        const topUpDue = plan.topUp > 0;
        const startDate = topUpDue ? null : input.startDate || todayUtc();
        if (startDate && startDate > todayUtc()) throw Object.assign(new Error('The start date cannot be in the future.'), { status: 400 });
        const profitPct = input.profitPercentage ?? (source.capital > 0 ? Math.round((input.profitAmount / source.capital) * 10000) / 100 : 0);
        const sourceRef = source.booking?.bookingId || `line ${input.idProjectInvestors}`;
        const ref = await nextBookingRef(transaction);

        // 1. The matured line is closed as reinvested, with its actual profit.
        const sourceStatus = input.mode === 'capital_only' ? 'reinvested_capital' : 'reinvested_full';
        source.line.investmentStatus = sourceStatus as any;
        source.line.actualProfitAmount = input.profitAmount as any;
        source.line.actualProfitPercentage = profitPct as any;
        await source.line.save({ transaction });
        const how = input.mode === 'capital_only' ? 'capital only' : input.mode === 'capital_profit' ? 'capital and profit' : `capital and profit with a top-up of BDT ${fmt(plan.topUp)}`;
        await ProjectInvestorStatusEntry(sourceStatus, input.idProjectInvestors, auth.idUsers, `Reinvested (${how}) into booking #${ref}`, transaction);

        // 2. The new booking on the investor's account.
        const booking = await (ProjectInvestmentBooking as any).create({
            idUsers,
            bookingId: ref,
            paymentConfirmationStatus: topUpDue ? 'pending' : 'confirmed',
            paymentAmount: plan.investment,
            paymentDate: startDate,
            cancelled: 'no',
            collectionRequired: 'no',
            bookingType: 'reinvestment',
            reinvestedAmount: plan.reinvested,
            idSourceProjectInvestors: input.idProjectInvestors,
            // No new money moved, so the matured booking's receipt stands for it
            // (as reinvest.ts did). A top-up needs its own receipt.
            proofOfPayment: topUpDue ? null : source.booking?.proofOfPayment || null,
        }, { transaction });
        const idBooking = booking.idProjectInvestmentBookings;
        await BookingStatusEntry('placed', idBooking, auth.idUsers, `Reinvestment of booking #${sourceRef}`, transaction);
        if (!topUpDue) await BookingStatusEntry('confirmed', idBooking, auth.idUsers, 'Reinvestment with no new money: confirmed at once', transaction);

        // 3. Its investment line and partner allocation.
        const line = await ProjectInvestor.create({
            idProjects: input.idProjects,
            idUsers,
            idProjectInvestmentBookings: idBooking,
            unitPurchased: input.units,
            investmentStatus: topUpDue ? 'booked' : 'confirmed',
            investmentDate: startDate || todayUtc(),
        } as any, { transaction });
        await ProjectInvestorStatusEntry(topUpDue ? 'booked' : 'confirmed', line.idProjectInvestors as number, auth.idUsers, `Reinvestment from booking #${sourceRef}`, transaction);
        await (ProjectPartnerInvestor as any).create({
            idProjectInvestors: line.idProjectInvestors,
            idProjectPartners: input.idProjectPartners,
            amountInvested: plan.investment,
            investedUnit: input.units,
        }, { transaction });

        // 4. Money that did not go into the new booking, and balance used for it.
        const entry = (amount: number, entryType: string, note: string) =>
            InvestorBalanceEntry.create({
                idUsers, amount, entryType: entryType as any, note,
                idProjectInvestors: input.idProjectInvestors, idProjectInvestmentBookings: idBooking, createdBy: auth.idUsers,
            }, { transaction });
        if (plan.payout > 0) {
            await entry(plan.payout, 'profit_payable', `Profit${plan.payout > input.profitAmount ? ' and unused capital' : ''} from booking #${sourceRef}, to pay out`);
            if (input.payoutDoneNow) await entry(-plan.payout, 'paid_out', `Paid out when booking #${sourceRef} was reinvested`);
        }
        if (plan.kept > 0) await entry(plan.kept, 'reinvest_remainder', `Left over from reinvesting booking #${sourceRef} (less than one unit)`);
        if (plan.fromBalance > 0) await entry(-plan.fromBalance, 'applied_to_booking', `Used toward booking #${ref}`);

        await transaction.commit();

        const term = Number(t.duration) || 0;
        outcome = {
            newBookingId: idBooking,
            newBookingRef: ref,
            topUp: plan.topUp,
            investment: plan.investment,
            reinvested: plan.reinvested,
            payout: plan.payout,
            payoutDoneNow: input.payoutDoneNow && plan.payout > 0,
            kept: plan.kept,
            fromBalance: plan.fromBalance,
            startDate,
            maturityDate: startDate && term ? addTerm(startDate, term, t.tenure) : null,
            projectName: t.projectName,
            balanceAfter: Math.round((balance + plan.payout * (input.payoutDoneNow ? 0 : 1) + plan.kept - plan.fromBalance) * 100) / 100,
        };
    } catch (err) {
        await transaction.rollback().catch(() => undefined);
        const status = (err as any).status || 400;
        return res.status(status).json({ success: false, message: (err as Error).message });
    }

    // Tell the investor (best effort: a failed notification must not undo the booking).
    let notified = false;
    if (input.notify) {
        try {
            const investor = await User.findByPk((await ProjectInvestmentBooking.findByPk(outcome.newBookingId))!.idUsers);
            if (investor) {
                if (outcome.topUp > 0) {
                    await generateNotification('reinvestment_topup_due', {
                        fullName: investor.fullName, bookingId: outcome.newBookingRef, projectName: outcome.projectName,
                        // Formatted copies for the SMS/push text, numbers for the email.
                        investment: fmt(outcome.investment), topUp: fmt(outcome.topUp), reinvested: fmt(outcome.reinvested),
                        investmentAmount: outcome.investment, topUpAmount: outcome.topUp, reinvestedAmount: outcome.reinvested,
                    }, investor);
                } else {
                    const note = outcome.payout > 0 && !outcome.payoutDoneNow
                        ? ` Your profit of BDT ${fmt(outcome.payout)} will be paid to your bank account.`
                        : outcome.kept > 0
                          ? ` BDT ${fmt(outcome.kept)} is kept in your Shathi balance.`
                          : '';
                    await generateNotification('reinvestment_confirmed', {
                        fullName: investor.fullName, bookingId: outcome.newBookingRef, projectName: outcome.projectName,
                        investment: fmt(outcome.investment), startDate: outcome.startDate, maturityDate: outcome.maturityDate, note,
                        investmentAmount: outcome.investment,
                        payoutAmount: outcome.payout > 0 && !outcome.payoutDoneNow ? outcome.payout : null,
                        keptAmount: outcome.kept > 0 ? outcome.kept : null,
                    }, investor);
                }
                notified = true;
            }
        } catch (e) {
            console.error('Reinvestment notification failed:', (e as Error).message);
        }
    }

    return res.status(200).json({ success: true, message: 'Reinvestment created', data: { ...outcome, notified } });
}

export default withCors(requireAdmin(handler));
