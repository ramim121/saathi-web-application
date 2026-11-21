/**
 * Reinvesting a matured investment: the arithmetic, in one place.
 *
 * Used twice with the same inputs: the admin dialog previews the plan as the
 * admin edits it, and the API recomputes it from the database before saving,
 * so what was shown is what is recorded. No server-only imports here.
 *
 * Money is handled in whole paisa (integers) and returned in taka.
 *
 *   capital_only    Whole units bought with the capital. The profit, plus any
 *                   capital that does not make a whole unit, is owed to the
 *                   investor (paid out).
 *   capital_profit  Whole units bought with capital + profit (+ the investor's
 *                   balance, if chosen). What does not make a whole unit is
 *                   kept in the investor's balance.
 *   top_up          More units than capital + profit (+ balance) cover. The
 *                   investor pays the difference.
 */

export type ReinvestMode = 'capital_only' | 'capital_profit' | 'top_up';

export const REINVEST_MODES: ReinvestMode[] = ['capital_only', 'capital_profit', 'top_up'];

export type ReinvestInput = {
    mode: ReinvestMode;
    /** The money originally invested in the matured line (its recorded allocations). */
    capital: number;
    /** Actual profit on the matured line. */
    profit: number;
    /** What the investor already has in their balance (only positive amounts can be used). */
    balance: number;
    useBalance: boolean;
    /** Price of one unit of the project being invested in. */
    unitValue: number;
    units: number;
};

export type ReinvestPlan = {
    mode: ReinvestMode;
    units: number;
    minUnits: number;
    /** Infinity for top_up: only the project's own limits apply. */
    maxUnits: number;
    unitValue: number;
    /** units x unit value. */
    investment: number;
    fromCapital: number;
    fromProfit: number;
    fromBalance: number;
    /** Carried over from the matured investment (and balance): no new money. */
    reinvested: number;
    /** New money the investor pays. */
    topUp: number;
    /** Owed to the investor and to be paid out (capital_only). */
    payout: number;
    /** Added to the investor's balance (capital_profit). */
    kept: number;
    /** Why the plan cannot be saved, in plain words; null when it can. */
    problem: string | null;
};

const toPaisa = (taka: number) => Math.round((Number(taka) || 0) * 100);
const toTaka = (paisa: number) => paisa / 100;

export function planReinvestment(input: ReinvestInput): ReinvestPlan {
    const C = toPaisa(input.capital);
    const P = toPaisa(input.profit);
    const V = toPaisa(input.unitValue);
    const usableBalance = input.useBalance && input.mode !== 'capital_only' ? Math.max(0, toPaisa(input.balance)) : 0;
    const units = Math.max(0, Math.floor(Number(input.units) || 0));

    const blank = {
        mode: input.mode,
        units,
        unitValue: toTaka(V),
        investment: 0,
        fromCapital: 0,
        fromProfit: 0,
        fromBalance: 0,
        reinvested: 0,
        topUp: 0,
        payout: 0,
        kept: 0,
    };
    if (V <= 0) return { ...blank, minUnits: 0, maxUnits: 0, problem: 'The project has no unit price.' };
    if (C <= 0) return { ...blank, minUnits: 0, maxUnits: 0, problem: 'The matured investment has no recorded capital.' };
    if (P < 0) return { ...blank, minUnits: 0, maxUnits: 0, problem: 'Profit cannot be negative here. Settle a loss with “Mark ready for withdrawal”.' };

    const investment = units * V;

    if (input.mode === 'capital_only') {
        const maxUnits = Math.floor(C / V);
        const problem =
            maxUnits < 1
                ? `The capital (${toTaka(C).toLocaleString('en-IN')}) is less than one unit of this project.`
                : units < 1 || units > maxUnits
                  ? `Choose between 1 and ${maxUnits} unit${maxUnits === 1 ? '' : 's'}.`
                  : null;
        const used = Math.min(investment, C);
        return {
            ...blank,
            minUnits: Math.min(1, maxUnits),
            maxUnits,
            investment: toTaka(investment),
            fromCapital: toTaka(used),
            reinvested: toTaka(used),
            payout: toTaka(P + (C - used)),
            problem,
        };
    }

    const pool = C + P + usableBalance;

    if (input.mode === 'capital_profit') {
        const maxUnits = Math.floor(pool / V);
        const problem =
            maxUnits < 1
                ? 'Capital and profit together are less than one unit of this project.'
                : units < 1 || units > maxUnits
                  ? `Choose between 1 and ${maxUnits} unit${maxUnits === 1 ? '' : 's'}.`
                  : null;
        const fromCapital = Math.min(C, investment);
        const fromProfit = Math.min(P, investment - fromCapital);
        const fromBalance = Math.min(usableBalance, investment - fromCapital - fromProfit);
        return {
            ...blank,
            minUnits: Math.min(1, maxUnits),
            maxUnits,
            investment: toTaka(investment),
            fromCapital: toTaka(fromCapital),
            fromProfit: toTaka(fromProfit),
            fromBalance: toTaka(fromBalance),
            reinvested: toTaka(fromCapital + fromProfit + fromBalance),
            // Whatever of capital + profit was not invested stays with the investor.
            kept: toTaka(C + P - fromCapital - fromProfit),
            problem,
        };
    }

    // top_up: everything available goes in, and the investor adds the rest.
    const minUnits = Math.floor(pool / V) + 1;
    const problem = units < minUnits ? `A top-up needs at least ${minUnits} units (capital and profit already cover ${minUnits - 1}).` : null;
    return {
        ...blank,
        minUnits,
        maxUnits: Infinity,
        investment: toTaka(investment),
        fromCapital: toTaka(C),
        fromProfit: toTaka(P),
        fromBalance: toTaka(usableBalance),
        reinvested: toTaka(pool),
        topUp: toTaka(Math.max(0, investment - pool)),
        problem,
    };
}

/** Units the dialog starts with for each mode. */
export function defaultUnits(input: Omit<ReinvestInput, 'units'>): number {
    const plan = planReinvestment({ ...input, units: 0 });
    if (input.mode === 'top_up') return plan.minUnits;
    return Math.max(plan.maxUnits, 0);
}

/** `YYYY-MM-DD` plus a project term, in UTC (the arithmetic the reports use). */
export function addTerm(start: string, duration: number, tenure: string | null | undefined): string {
    const [y, m, d] = start.slice(0, 10).split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    if (tenure === 'years') date.setUTCFullYear(date.getUTCFullYear() + duration);
    else date.setUTCMonth(date.getUTCMonth() + duration);
    return date.toISOString().slice(0, 10);
}
