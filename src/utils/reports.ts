import { QueryTypes } from 'sequelize';
import sequelize from '@/config/db';

/**
 * Operational reports.
 *
 * Separate from `dashboard.ts` because the two answer different questions. The
 * dashboard asks "where do we stand right now" and is deliberately unfiltered;
 * a report asks "what happened between these dates" and is useless without a
 * range. Sharing one module would mean every dashboard figure growing a date
 * parameter it does not want.
 *
 * All three reports below are exportable, so each row is flat — no nested
 * objects, nothing that only makes sense rendered.
 */

const AMOUNT = 'pi.unit_purchased * p.unit_investment_value';

const MATURITY = `
    DATE_ADD(
        COALESCE(b.payment_date, pi.investment_date, pi.created_at),
        INTERVAL CASE WHEN p.tenure = 'years' THEN p.duration * 12 ELSE p.duration END MONTH
    )`;

const PLACED = 'COALESCE(b.payment_date, pi.investment_date, pi.created_at)';

export type ReportRange = { from: string; to: string };

export type RegisterRow = {
    reference: string;
    investor: string;
    phone: string;
    project: string;
    investmentType: string;
    units: number;
    unitValue: number;
    capital: number;
    source: string;
    status: string;
    placedOn: string;
    maturesOn: string;
};

export type ScheduleRow = {
    month: string;
    positions: number;
    capital: number;
    minProfit: number;
    maxProfit: number;
    minPayable: number;
    maxPayable: number;
};

export type CollectionRow = {
    method: string;
    bookings: number;
    amount: number;
};

export type Reports = {
    range: ReportRange;
    register: RegisterRow[];
    schedule: ScheduleRow[];
    collections: CollectionRow[];
    totals: { capital: number; positions: number; investors: number };
    generatedAt: string;
};

const n = (v: unknown): number => Number(v ?? 0) || 0;
const s = (v: unknown): string => (v == null ? '' : String(v));
const day = (v: unknown): string => (v ? new Date(v as string).toISOString().slice(0, 10) : '');

/** Clamps a caller-supplied date to `YYYY-MM-DD`, falling back to a default. */
export function safeDate(value: unknown, fallback: string): string {
    const text = typeof value === 'string' ? value.trim() : '';
    return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : fallback;
}

export function defaultRange(): ReportRange {
    const to = new Date();
    const from = new Date(to);
    from.setMonth(from.getMonth() - 12);
    return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export async function loadReports(range: ReportRange): Promise<Reports> {
    /*
     * Bound parameters, not interpolation. The range reaches this function from
     * a query string, and `safeDate` already shapes it, but a report is exactly
     * the kind of page that later grows a free-text filter — binding keeps that
     * change from becoming an injection.
     */
    const bind = { from: range.from, to: range.to };
    const q = <T extends object>(sql: string) =>
        sequelize.query<T>(sql, { type: QueryTypes.SELECT, replacements: bind });

    const register = (await q<Record<string, unknown>>(`
        SELECT COALESCE(b.booking_id, CONCAT('INV-', pi.id_project_investors)) AS reference,
               COALESCE(u.full_name, CONCAT('User #', u.id_users)) AS investor,
               COALESCE(u.phone_number, '') AS phone,
               p.project_name AS project,
               COALESCE(p.investment_type, '') AS investmentType,
               pi.unit_purchased AS units,
               p.unit_investment_value AS unitValue,
               ${AMOUNT} AS capital,
               CASE WHEN b.booking_type = 'reinvestment' THEN 'Rollover' ELSE 'Fresh' END AS source,
               pi.investment_status AS status,
               ${PLACED} AS placedOn,
               ${MATURITY} AS maturesOn
          FROM project_investors pi
          JOIN projects p ON p.id_projects = pi.id_projects
          JOIN users u ON u.id_users = pi.id_users
          LEFT JOIN project_investment_bookings b
                 ON b.id_project_investment_bookings = pi.id_project_investment_bookings
         WHERE pi.investment_status IN ('confirmed', 'booked')
           AND DATE(${PLACED}) BETWEEN :from AND :to
         ORDER BY ${PLACED} DESC`)).map((r) => ({
        reference: s(r.reference),
        investor: s(r.investor),
        phone: s(r.phone),
        project: s(r.project),
        investmentType: s(r.investmentType),
        units: n(r.units),
        unitValue: n(r.unitValue),
        capital: n(r.capital),
        source: s(r.source),
        status: s(r.status),
        placedOn: day(r.placedOn),
        maturesOn: day(r.maturesOn),
    }));

    /*
     * The payout schedule is grouped by the month a position matures, not by
     * the month it was placed — it answers "what do we owe, and when".
     * Profit is a band because each project quotes a range, and reporting a
     * single figure would imply a precision the projects do not promise.
     */
    const schedule = (await q<Record<string, unknown>>(`
        SELECT DATE_FORMAT(${MATURITY}, '%Y-%m') AS month,
               COUNT(*) AS positions,
               SUM(${AMOUNT}) AS capital,
               SUM(${AMOUNT} * p.return_range_min / 100) AS minProfit,
               SUM(${AMOUNT} * COALESCE(p.return_range_max, p.return_range_min) / 100) AS maxProfit
          FROM project_investors pi
          JOIN projects p ON p.id_projects = pi.id_projects
          LEFT JOIN project_investment_bookings b
                 ON b.id_project_investment_bookings = pi.id_project_investment_bookings
         WHERE pi.investment_status = 'confirmed'
           AND DATE(${MATURITY}) BETWEEN :from AND :to
         GROUP BY month
         ORDER BY month ASC`)).map((r) => {
        const capital = n(r.capital);
        const minProfit = n(r.minProfit);
        const maxProfit = n(r.maxProfit);
        return {
            month: s(r.month),
            positions: n(r.positions),
            capital,
            minProfit,
            maxProfit,
            minPayable: capital + minProfit,
            maxPayable: capital + maxProfit,
        };
    });

    const collections = (await q<Record<string, unknown>>(`
        SELECT COALESCE(NULLIF(b.payment_method, ''), 'Not recorded') AS method,
               COUNT(DISTINCT b.id_project_investment_bookings) AS bookings,
               COALESCE(SUM((
                   SELECT COALESCE(SUM(pi2.unit_purchased * p2.unit_investment_value), 0)
                     FROM project_investors pi2
                     JOIN projects p2 ON p2.id_projects = pi2.id_projects
                    WHERE pi2.id_project_investment_bookings = b.id_project_investment_bookings
                      AND pi2.investment_status = 'confirmed'
               )), 0) AS amount
          FROM project_investment_bookings b
         WHERE b.cancelled = 'no'
           AND b.payment_confirmation_status = 'confirmed'
           AND DATE(COALESCE(b.payment_date, b.created_at)) BETWEEN :from AND :to
         GROUP BY method
         ORDER BY amount DESC`)).map((r) => ({
        method: s(r.method),
        bookings: n(r.bookings),
        amount: n(r.amount),
    }));

    const investors = new Set(register.map((r) => `${r.investor}|${r.phone}`)).size;

    return {
        range,
        register,
        schedule,
        collections,
        totals: {
            capital: register.reduce((a, r) => a + r.capital, 0),
            positions: register.length,
            investors,
        },
        generatedAt: new Date().toISOString(),
    };
}

/**
 * Renders rows as CSV.
 *
 * Every field is quoted and inner quotes doubled, which is what RFC 4180 asks
 * for and what stops a project name containing a comma from shifting every
 * column after it. A leading `=`, `+`, `-` or `@` is prefixed with a quote as
 * well: spreadsheet software treats those as formulas, so a name like
 * `=cmd|...` would execute on open rather than display.
 */
export function toCsv(rows: Array<Record<string, unknown>>, headers: string[]): string {
    const cell = (v: unknown): string => {
        let text = v == null ? '' : String(v);
        if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
        return `"${text.replace(/"/g, '""')}"`;
    };
    const lines = [headers.map(cell).join(',')];
    for (const row of rows) {
        lines.push(headers.map((h) => cell(row[h])).join(','));
    }
    return lines.join('\r\n');
}
