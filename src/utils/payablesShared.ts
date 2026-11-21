/**
 * The payables forecast's windows and row shapes. Browser-safe: pages import
 * this file, so it must not import anything server-only.
 */

export type PayableWindowKey = 'ready' | 'overdue' | 'd15' | 'd30' | 'd60' | 'd90' | 'later';

export const PAYABLE_WINDOWS: { key: PayableWindowKey; label: string; hint: string }[] = [
    { key: 'ready', label: 'Ready to pay', hint: 'An admin set the final profit; waiting to be marked paid' },
    { key: 'overdue', label: 'Overdue', hint: 'Past maturity and not yet processed' },
    { key: 'd15', label: 'Next 15 days', hint: 'Due today to 15 days from now' },
    { key: 'd30', label: '16–30 days', hint: 'Due in 16 to 30 days' },
    { key: 'd60', label: '31–60 days', hint: 'Due in 31 to 60 days' },
    { key: 'd90', label: '61–90 days', hint: 'Due in 61 to 90 days' },
    { key: 'later', label: 'After 90 days', hint: 'Due more than 90 days from now' },
];

export type PayableRow = {
    idProjectInvestors: number;
    idBooking: number | null;
    bookingRef: string | null;
    idUsers: number;
    investor: string;
    phone: string | null;
    idProjects: number;
    project: string;
    partners: string;
    status: string;
    source: 'Fresh' | 'Rollover';
    units: number;
    capital: number;
    minProfit: number;
    maxProfit: number;
    /** True when an admin has entered the actual profit. */
    profitFinal: boolean;
    minTotal: number;
    maxTotal: number;
    startDate: string | null;
    dueDate: string;
    daysLeft: number;
    window: PayableWindowKey;
};

export type PayableWindowSummary = {
    key: PayableWindowKey;
    label: string;
    hint: string;
    count: number;
    investors: number;
    capital: number;
    minProfit: number;
    maxProfit: number;
    minTotal: number;
    maxTotal: number;
};

export type HeldBalance = { idUsers: number; investor: string; phone: string | null; balance: number };

export type PayablesReport = {
    today: string;
    rows: PayableRow[];
    windows: PayableWindowSummary[];
    held: HeldBalance[];
    heldTotal: number;
    generatedAt: string;
};

export function windowFor(status: string, daysLeft: number): PayableWindowKey {
    if (status !== 'confirmed') return 'ready';
    if (daysLeft < 0) return 'overdue';
    if (daysLeft <= 15) return 'd15';
    if (daysLeft <= 30) return 'd30';
    if (daysLeft <= 60) return 'd60';
    if (daysLeft <= 90) return 'd90';
    return 'later';
}

export function summarizeWindows(rows: PayableRow[]): PayableWindowSummary[] {
    return PAYABLE_WINDOWS.map((w) => {
        const inWindow = rows.filter((r) => r.window === w.key);
        const sum = (pick: (r: PayableRow) => number) => inWindow.reduce((total, r) => total + pick(r), 0);
        return {
            ...w,
            count: inWindow.length,
            investors: new Set(inWindow.map((r) => r.idUsers)).size,
            capital: sum((r) => r.capital),
            minProfit: sum((r) => r.minProfit),
            maxProfit: sum((r) => r.maxProfit),
            minTotal: sum((r) => r.minTotal),
            maxTotal: sum((r) => r.maxTotal),
        };
    });
}
