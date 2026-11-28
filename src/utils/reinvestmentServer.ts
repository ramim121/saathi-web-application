import { Op, literal, type Transaction } from 'sequelize';
import {
    InvestorBalanceEntry,
    Project,
    ProjectInvestmentBooking,
    ProjectInvestor,
    ProjectPartner,
    ProjectPartnerInvestor,
    User,
} from '@/models/__associations';
import { addTerm } from '@/utils/reinvestment';
import { projectUnitsSql, usesCapacity } from '@/utils/bookingHolds';
import { unitsUsed } from '@/utils/partnerCapacity';
import ProjectInvestorStatusEntry from '@/utils/ProjectInvestorStatusEntry';

/**
 * Server side of reinvesting a matured investment (the arithmetic is in
 * src/utils/reinvestment.ts). Shared by api/bookings/reinvestment/*.
 */

export const MATURED_STATUSES = ['ready_for_withdrawal', 'request_withdrawal'];
export const REINVESTED_STATUSES = ['reinvested_capital', 'reinvested_full', 'reinvested_profit'];

const todayUtc = () => new Date().toISOString().slice(0, 10);
const isoDay = (value: unknown): string | null => {
    if (!value) return null;
    const d = new Date(value as string);
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

export type ReinvestSource = Awaited<ReturnType<typeof loadReinvestSource>>;

/**
 * A matured line with everything the reinvestment needs: the capital actually
 * recorded for it (the sum of its partner allocations, as reinvest.ts and the
 * investor report use), its profit, its maturity, and whether it can be
 * reinvested now.
 */
export async function loadReinvestSource(idProjectInvestors: number, transaction?: Transaction) {
    const line = await ProjectInvestor.findByPk(idProjectInvestors, {
        include: [ProjectInvestmentBooking, Project],
        transaction,
    });
    if (!line) return null;
    const booking = (line as any).ProjectInvestmentBooking as any;
    const project = (line as any).Project as any;
    const user = await User.findByPk(line.idUsers, {
        attributes: ['idUsers', 'fullName', 'phoneNumber', 'email', 'phoneVerified', 'emailVerified', 'preferredLanguage'],
        transaction,
    });

    const recorded = Number((await ProjectPartnerInvestor.sum('amountInvested', { where: { idProjectInvestors }, transaction })) || 0);
    const firstAllocation = await ProjectPartnerInvestor.findOne({ where: { idProjectInvestors }, attributes: ['idProjectPartners'], order: [['idProjectPartnerInvestors', 'ASC']], transaction });
    const capital = recorded > 0 ? recorded : Number(line.unitPurchased) * Number(project?.unitInvestmentValue || 0);

    const start = isoDay(booking?.paymentDate) || isoDay(line.investmentDate);
    const maturityDate = start && project?.duration ? addTerm(start, Number(project.duration), project.tenure) : null;

    const status = String(line.investmentStatus);
    const bookingConfirmed = booking?.paymentConfirmationStatus === 'confirmed' && booking?.cancelled !== 'yes';
    let reason: string | null = null;
    if (REINVESTED_STATUSES.includes(status)) reason = 'This investment has already been reinvested.';
    else if (status === 'withdrawn') reason = 'This investment has already been paid out.';
    else if (status === 'cancelled' || booking?.cancelled === 'yes') reason = 'This investment was cancelled.';
    else if (!bookingConfirmed) reason = 'The booking has not been paid and confirmed.';
    else if (!MATURED_STATUSES.includes(status) && !(status === 'confirmed' && maturityDate && maturityDate <= todayUtc())) {
        reason = maturityDate ? `This investment matures on ${maturityDate}.` : 'This investment has no maturity date yet.';
    }

    const actualProfit = line.actualProfitAmount === null || line.actualProfitAmount === undefined ? null : Number(line.actualProfitAmount);
    return {
        line,
        booking,
        project,
        user,
        capital,
        idProjectPartners: (firstAllocation as any)?.idProjectPartners ?? null,
        maturityDate,
        status,
        profitRecorded: MATURED_STATUSES.includes(status) && actualProfit !== null,
        actualProfit,
        actualProfitPercentage: line.actualProfitPercentage === null || line.actualProfitPercentage === undefined ? null : Number(line.actualProfitPercentage),
        expectedProfit: {
            min: Math.round((capital * Number(project?.returnRangeMin || 0)) / 100),
            max: Math.round((capital * Number(project?.returnRangeMax || 0)) / 100),
        },
        eligible: reason === null,
        reason,
    };
}

/** What the investor has in their balance now (+ owed to them). */
export async function balanceOf(idUsers: number, transaction?: Transaction): Promise<number> {
    const sum = await InvestorBalanceEntry.sum('amount', { where: { idUsers }, transaction });
    return Math.round(Number(sum || 0) * 100) / 100;
}

/**
 * Projects open for new money, as on the New booking page (not closed, units
 * left). Units left counts paid units and live holds (utils/bookingHolds.ts).
 */
export async function openProjects() {
    const rows = await Project.findAll({
        attributes: [
            'idProjects', 'projectName', 'unitInvestmentValue', 'duration', 'tenure', 'returnRangeMin', 'returnRangeMax',
            'totalAvailableUnits', 'investorUnitCapacity', 'projectStatus',
            [literal(projectUnitsSql('Project.id_projects', 'used')), 'confirmedUnits'],
        ],
        where: { projectStatus: { [Op.notIn]: ['closed', 'completed'] } },
        order: [['projectName', 'ASC']],
    });
    return rows
        .map((r) => r.get({ plain: true }) as any)
        .map((p) => {
            const total = Number(p.totalAvailableUnits) || 0;
            const confirmed = Number(p.confirmedUnits) || 0;
            return {
                idProjects: p.idProjects,
                projectName: p.projectName,
                unitInvestmentValue: Number(p.unitInvestmentValue) || 0,
                duration: Number(p.duration) || 0,
                tenure: p.tenure,
                returnRangeMin: Number(p.returnRangeMin) || 0,
                returnRangeMax: Number(p.returnRangeMax) || 0,
                investorUnitCapacity: Number(p.investorUnitCapacity) || 0,
                /** null = no limit. */
                remainingUnits: total > 0 ? Math.max(0, total - confirmed) : null,
            };
        })
        .filter((p) => p.unitInvestmentValue > 0 && (p.remainingUnits === null || p.remainingUnits > 0));
}

/**
 * The checks api/bookings/confirm.ts makes before money goes in, run before a
 * reinvestment is created so an impossible one is refused up front. Paid
 * units and live holds count (utils/bookingHolds.ts), as there.
 *
 * `leavingLine` is the matured line being reinvested: a matured line can still
 * be `confirmed`, but its units leave the project as this booking is made, so
 * they must not count against the limits (an investor at the per-investor
 * limit could otherwise never reinvest in the same project).
 */
export async function capacityProblem(
    args: { idProjects: number; idProjectPartners: number; idUsers: number; units: number; leavingLine?: number },
    transaction?: Transaction,
): Promise<string | null> {
    const project = await Project.findByPk(args.idProjects, { attributes: ['projectName', 'totalAvailableUnits', 'investorUnitCapacity'], transaction });
    if (!project) return 'Project not found.';
    const p = project as any;
    const leaving = Number.isInteger(args.leavingLine) && (args.leavingLine as number) > 0 ? (args.leavingLine as number) : 0;
    const usedInProject = await unitsUsed({ idProjects: args.idProjects, excludeLine: leaving || undefined }, transaction);
    const total = Number(p.totalAvailableUnits) || 0;
    if (total > 0 && usedInProject + args.units > total) {
        return `${p.projectName} has ${Math.max(0, total - usedInProject)} unit(s) left.`;
    }
    const cap = Number(p.investorUnitCapacity) || 0;
    if (cap > 0) {
        const held = await unitsUsed({ idProjects: args.idProjects, idUsers: args.idUsers, excludeLine: leaving || undefined }, transaction);
        if (held + args.units > cap) return `This investor holds or has booked ${held} unit(s) in ${p.projectName}; ${args.units} more would pass the limit of ${cap} per investor.`;
    }
    const partner = await ProjectPartner.findOne({ where: { idProjectPartners: args.idProjectPartners, idProjects: args.idProjects }, attributes: ['partnerUnitCapacity'], transaction });
    if (!partner) return 'Choose a partner of this project.';
    const partnerCap = Number((partner as any).partnerUnitCapacity) || 0;
    if (partnerCap > 0) {
        const invested = Number(
            (await ProjectPartnerInvestor.sum('investedUnit', {
                where: {
                    idProjectPartners: args.idProjectPartners,
                    // `leaving` is a validated integer, so it is safe in the literal.
                    idProjectInvestors: {
                        [Op.in]: literal(`(SELECT pi.id_project_investors FROM project_investors pi
                            LEFT JOIN project_investment_bookings b ON b.id_project_investment_bookings = pi.id_project_investment_bookings
                            WHERE ${usesCapacity('pi', 'b')} AND pi.id_project_investors <> ${leaving})`),
                    },
                },
                transaction,
            })) || 0,
        );
        if (invested + args.units > partnerCap) return `This partner can take ${Math.max(0, partnerCap - invested)} more unit(s).`;
    }
    return null;
}

/** Next 6-digit booking reference, as manual_booking.ts and reinvest.ts make them. */
export async function nextBookingRef(transaction?: Transaction): Promise<string> {
    const max = await (ProjectInvestmentBooking as any).max('bookingId', { transaction });
    return (max ? parseInt(String(max), 10) + 1 : 1).toString().padStart(6, '0');
}

/**
 * A cancelled reinvestment booking gives the matured money back to the matured
 * line: the line returns to `ready_for_withdrawal` (its actual profit kept), and
 * the balance entries the reinvestment made are reversed. Payouts already made
 * are real money and are left alone. Safe to call for any booking.
 */
export async function undoReinvestment(
    booking: { idProjectInvestmentBookings?: number; bookingId?: string | null; bookingType?: string; idSourceProjectInvestors?: number | null },
    actorId: number,
    transaction: Transaction,
): Promise<boolean> {
    if (booking.bookingType !== 'reinvestment' || !booking.idSourceProjectInvestors || !booking.idProjectInvestmentBookings) return false;
    const ref = booking.bookingId || String(booking.idProjectInvestmentBookings);
    const source = await ProjectInvestor.findByPk(booking.idSourceProjectInvestors, { transaction, lock: transaction.LOCK.UPDATE });
    if (source && REINVESTED_STATUSES.includes(String(source.investmentStatus))) {
        source.investmentStatus = 'ready_for_withdrawal' as any;
        await source.save({ transaction });
        await ProjectInvestorStatusEntry('ready_for_withdrawal', source.idProjectInvestors as number, actorId, `Reinvestment booking #${ref} cancelled: matured again`, transaction);
    }
    const entries = await InvestorBalanceEntry.findAll({
        where: {
            idProjectInvestmentBookings: booking.idProjectInvestmentBookings,
            entryType: { [Op.in]: ['profit_payable', 'reinvest_remainder', 'applied_to_booking'] },
        },
        transaction,
    });
    for (const e of entries) {
        const reversed = await InvestorBalanceEntry.count({ where: { reversesId: e.idInvestorBalanceEntries }, transaction });
        if (reversed) continue;
        await InvestorBalanceEntry.create({
            idUsers: e.idUsers,
            amount: -Number(e.amount),
            entryType: 'reversal',
            reversesId: e.idInvestorBalanceEntries,
            idProjectInvestors: e.idProjectInvestors,
            idProjectInvestmentBookings: e.idProjectInvestmentBookings,
            note: `Reversed: reinvestment booking #${ref} cancelled`,
            createdBy: actorId,
        }, { transaction });
    }
    return true;
}
