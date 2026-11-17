/**
 * Formatting for the redesigned screens. Deterministic on purpose: the same
 * output on the server and in the browser, so server-rendered pages hydrate
 * without mismatches (no locale- or timezone-dependent Intl date output).
 */

const grouped = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

/** ৳20,00,000 — Bangladeshi grouping. */
export function bdt(value: number | null | undefined): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return '—';
    const sign = value < 0 ? '−' : '';
    return `${sign}৳${grouped.format(Math.round(Math.abs(value)))}`;
}

const groupedExact = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });

/** ৳25,000 or ৳33,333.33 — keeps paisa when there are any (unit prices, receipts). */
export function bdtExact(value: number | null | undefined): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return '—';
    const sign = value < 0 ? '−' : '';
    return `${sign}৳${groupedExact.format(Math.abs(value))}`;
}

function trimmed(x: number): string {
    const fixed = x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toFixed(2);
    return fixed.includes('.') ? fixed.replace(/0+$/, '').replace(/\.$/, '') : fixed;
}

/** ৳20 L, ৳1.2 Cr, ৳55K — for lists and tight spaces. */
export function bdtCompact(value: number | null | undefined): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return '—';
    const a = Math.abs(value);
    const sign = value < 0 ? '−' : '';
    if (a >= 1e7) return `${sign}৳${trimmed(a / 1e7)} Cr`;
    if (a >= 1e5) return `${sign}৳${trimmed(a / 1e5)} L`;
    if (a >= 1e3) return `${sign}৳${trimmed(a / 1e3)}K`;
    return `${sign}৳${Math.round(a)}`;
}

/** ৳1.38–1.61 L, ৳60–70K — a range with the unit written once. */
export function bdtRange(min: number, max: number): string {
    const lo = Math.min(min, max);
    const hi = Math.max(min, max);
    if (lo >= 1e7) return `৳${trimmed(lo / 1e7)}–${trimmed(hi / 1e7)} Cr`;
    if (lo >= 1e5) return `৳${trimmed(lo / 1e5)}–${trimmed(hi / 1e5)} L`;
    if (lo >= 1e3 && hi < 1e5) return `৳${trimmed(lo / 1e3)}–${trimmed(hi / 1e3)}K`;
    return `${bdtCompact(lo)}–${bdtCompact(hi).replace('৳', '')}`;
}

export function pct(value: number | null | undefined, digits = 1): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return '—';
    return `${trimmed(Number(value.toFixed(digits)))}%`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 4 Oct 2026, from `YYYY-MM-DD` or an ISO timestamp (read as UTC). */
export function date(iso: string | null | undefined): string {
    if (!iso) return '—';
    const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
    if (!y || !m || !d) return '—';
    return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** Oct 2026 */
export function monthYear(iso: string | null | undefined): string {
    if (!iso) return '—';
    const [y, m] = iso.slice(0, 10).split('-').map(Number);
    return y && m ? `${MONTHS[m - 1]} ${y}` : '—';
}

const dayMs = 86_400_000;
const utcDay = (iso: string) => {
    const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
    return Date.UTC(y, m - 1, d);
};

/** Whole days from today (UTC) to `iso`; negative when it has passed. */
export function daysFromToday(iso: string): number {
    const now = new Date();
    return Math.round((utcDay(iso) - Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) / dayMs);
}

/** "in 12 days", "today", "3 days ago". */
export function relativeDays(iso: string | null | undefined): string {
    if (!iso) return '';
    const days = daysFromToday(iso);
    if (days === 0) return 'today';
    if (days === 1) return 'tomorrow';
    if (days === -1) return 'yesterday';
    return days > 0 ? `in ${days} days` : `${-days} days ago`;
}

export function plural(n: number, one: string, many = `${one}s`): string {
    return `${n} ${n === 1 ? one : many}`;
}

export function initials(name: string): string {
    // Punctuation is dropped so "Md. Rahim" reads MR, not M.; Latin, accented
    // Latin and Bangla letters are kept. (No Unicode regex flag: this project
    // compiles to ES5.)
    const parts = name
        .replace(/[^A-Za-z0-9À-ɏঀ-৿\s]/g, ' ')
        .trim()
        .split(/\s+/)
        .filter(Boolean);
    if (!parts.length) return '?';
    return ((parts[0].charAt(0) || '') + (parts.length > 1 ? parts[parts.length - 1].charAt(0) : '')).toUpperCase();
}

/** Digits only, without the 88 country code — for matching phone numbers. */
export function phoneDigits(value: string | null | undefined): string {
    return (value ?? '').replace(/\D/g, '').replace(/^88(?=01)/, '');
}
