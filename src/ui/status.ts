import type { Tone } from './primitives';

/**
 * One wording and one colour for each booking and investment state, used by
 * every redesigned screen, so "Payout due" is the same pill everywhere.
 */

export function paymentStatus(status: string | null | undefined, cancelled?: string | null): { label: string; tone: Tone } {
    if (cancelled === 'yes') return { label: 'Cancelled', tone: 'rose' };
    switch (status) {
        case 'confirmed':
            return { label: 'Confirmed', tone: 'green' };
        case 'uploaded':
        case 'proof_submitted':
            return { label: 'Proof submitted', tone: 'sky' };
        case 'denied':
            return { label: 'Denied', tone: 'rose' };
        case 'pending':
            return { label: 'Awaiting payment', tone: 'amber' };
        default:
            return { label: status ? status.replace(/_/g, ' ') : '—', tone: 'slate' };
    }
}

export function investmentStatus(status: string | null | undefined): { label: string; tone: Tone } {
    switch (status) {
        case 'booked':
            return { label: 'Booked', tone: 'amber' };
        case 'confirmed':
            return { label: 'Active', tone: 'green' };
        case 'request_withdrawal':
            return { label: 'Withdrawal requested', tone: 'sky' };
        case 'ready_for_withdrawal':
            return { label: 'Payout due', tone: 'sky' };
        case 'withdrawn':
            return { label: 'Paid out', tone: 'slate' };
        case 'reinvested_capital':
        case 'reinvested_full':
        case 'reinvested_profit':
            return { label: 'Rolled over', tone: 'violet' };
        case 'cancelled':
            return { label: 'Cancelled', tone: 'rose' };
        default:
            return { label: status ? status.replace(/_/g, ' ') : '—', tone: 'slate' };
    }
}

/** The project lifecycle (`projects.project_status`), in order. */
export const PROJECT_STATUSES: { value: string; label: string; tone: Tone }[] = [
    { value: 'created', label: 'Created', tone: 'slate' },
    { value: 'collection_started', label: 'Collecting', tone: 'sky' },
    { value: 'collection_done', label: 'Collection done', tone: 'violet' },
    { value: 'project_started', label: 'Running', tone: 'green' },
    { value: 'project_finished', label: 'Finished', tone: 'amber' },
    { value: 'fund_disbursed', label: 'Funds disbursed', tone: 'green' },
    { value: 'closed', label: 'Closed', tone: 'slate' },
    { value: 'completed', label: 'Completed', tone: 'slate' },
];

export function projectStatus(status: string | null | undefined): { label: string; tone: Tone } {
    const known = PROJECT_STATUSES.find((s) => s.value === status);
    return known ? { label: known.label, tone: known.tone } : { label: status ? status.replace(/_/g, ' ') : '—', tone: 'slate' };
}

/** Shathi Mart orders (`product_orders.order_status`), in order. */
export const ORDER_STATUSES: { value: string; label: string; tone: Tone }[] = [
    { value: 'placed', label: 'Placed', tone: 'amber' },
    { value: 'confirmed', label: 'Confirmed', tone: 'sky' },
    { value: 'shipped', label: 'Shipped', tone: 'violet' },
    { value: 'delivered', label: 'Delivered', tone: 'green' },
    { value: 'paid', label: 'Paid', tone: 'green' },
    { value: 'cancelled', label: 'Cancelled', tone: 'rose' },
    { value: 'returned', label: 'Returned', tone: 'rose' },
];

export function orderStatus(status: string | null | undefined): { label: string; tone: Tone } {
    const known = ORDER_STATUSES.find((s) => s.value === status);
    return known ? { label: known.label, tone: known.tone } : { label: status ? words(status) : '—', tone: 'slate' };
}

/** "Sustainable return" from `sustainable_return`. */
export function words(value: string | null | undefined): string {
    if (!value) return '—';
    const spaced = value.replace(/_/g, ' ');
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** "15%" when min and max agree (a fixed return), "15–20%" otherwise. */
export function returnRange(min: number | string | null | undefined, max: number | string | null | undefined): string {
    const lo = Number(min);
    const hi = Number(max);
    if (!Number.isFinite(lo) && !Number.isFinite(hi)) return '—';
    if (!Number.isFinite(hi) || lo === hi) return `${trimPct(lo)}%`;
    return `${trimPct(lo)}–${trimPct(hi)}%`;
}

const trimPct = (n: number) => (Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2))));

export function capitalise(value: string | null | undefined): string {
    if (!value) return '—';
    return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, ' ');
}

/*
 * Dates in Bangladesh time, assembled from parts.
 *
 * Formatting in the viewer's own timezone made the server (UTC) and the browser
 * (Asia/Dhaka) render different text, which broke hydration on the dashboard and
 * the investors page. A fixed timeZone fixes the values; building the string from
 * formatToParts (not .format) also keeps the punctuation identical, because
 * Node's and Chrome's ICU versions disagree on joiners like ", " vs " at ".
 */
const partsIn = (timeZone: string) =>
    new Intl.DateTimeFormat('en-GB', {
        timeZone,
        day: 'numeric',
        month: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
    });
const DHAKA_PARTS = partsIn('Asia/Dhaka');
const UTC_PARTS = partsIn('UTC');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function zoneParts(value: string | number | Date | null | undefined, format: Intl.DateTimeFormat) {
    if (!value) return null;
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    const p: Record<string, string> = {};
    for (const part of format.formatToParts(d)) p[part.type] = part.value;
    return { day: Number(p.day), month: Number(p.month), year: p.year, hour: p.hour, minute: p.minute };
}

const dhakaParts = (value: string | number | Date | null | undefined) => zoneParts(value, DHAKA_PARTS);

/** d/m/yyyy in Bangladesh time — the same text on the server and in every browser. */
export function dhakaDmy(value: string | number | Date | null | undefined): string {
    const p = dhakaParts(value);
    return p ? `${p.day}/${p.month}/${p.year}` : '—';
}

/** "17 Nov 2026, 21:40" in Bangladesh time. */
export function dhakaStamp(value: string | number | Date | null | undefined): string {
    const p = dhakaParts(value);
    return p ? `${p.day} ${MONTHS[p.month - 1]} ${p.year}, ${p.hour}:${p.minute}` : '—';
}

/**
 * "20 Nov 2026, 22:00" as stored, read as UTC. For columns the API writes as
 * wall-clock text rather than as an instant (a cheque or cash collection
 * time), which the old screens also displayed in UTC.
 */
export function utcStamp(value: string | number | Date | null | undefined): string {
    const p = zoneParts(value, UTC_PARTS);
    return p ? `${p.day} ${MONTHS[p.month - 1]} ${p.year}, ${p.hour}:${p.minute}` : '—';
}
