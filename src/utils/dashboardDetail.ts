import { QueryTypes } from 'sequelize';
import sequelize from '@/config/db';

/**
 * The rows behind each dashboard tile.
 *
 * A figure on a dashboard is only trustworthy if you can see what it is made
 * of. Every tile opens the exact set its number counts — same statuses, same
 * date rule — so a total and its breakdown cannot disagree.
 *
 * Loaded with the dashboard rather than on click. The largest of these is the
 * position list, which is one row per confirmed investment; at this scale that
 * is far cheaper than four more round trips and a loading state per tile.
 */

/** Money is derived everywhere: no amount column exists on either table. */
const AMOUNT = 'pi.unit_purchased * p.unit_investment_value';

/**
 * Maturity = the payment date (or the investment date) plus the project tenure.
 * Repeated rather than hidden in a view so it sits next to what it drives.
 */
const MATURITY = `
    DATE_ADD(
        COALESCE(b.payment_date, pi.investment_date, pi.created_at),
        INTERVAL CASE WHEN p.tenure = 'years' THEN p.duration * 12 ELSE p.duration END MONTH
    )`;

export type PositionRow = {
    idProjectInvestors: number;
    investor: string;
    project: string;
    investmentType: string | null;
    units: number;
    capital: number;
    /** Split so rolled-over capital is not counted as new money. */
    fresh: number;
    rollover: number;
    profit: number | null;
    investmentDate: string | null;
    maturityDate: string | null;
    bookingId: number | null;
    bookingRef: string | null;
};

export type PayoutRow = {
    idProjectInvestors: number;
    investor: string;
    project: string;
    capital: number;
    profit: number;
    totalPayable: number;
    maturityDate: string | null;
    bookingId: number | null;
    bookingRef: string | null;
};

export type PendingRow = {
    idProjectInvestmentBookings: number;
    bookingRef: string;
    investor: string;
    amount: number;
    method: string | null;
    status: string;
    submittedAt: string | null;
};

export type InvestorRow = {
    idUsers: number;
    investor: string;
    phone: string | null;
    positions: number;
    totalCapital: number;
    maturedPending: number;
    projects: string;
};

export type DashboardDetail = {
    positions: PositionRow[];
    payouts: PayoutRow[];
    pending: PendingRow[];
    investors: InvestorRow[];
};

const n = (v: unknown): number => Number(v ?? 0) || 0;
const iso = (v: unknown): string | null => (v ? new Date(v as string).toISOString() : null);

export async function loadDashboardDetail(): Promise<DashboardDetail> {
    const q = <T extends object>(sql: string) =>
        sequelize.query<T>(sql, { type: QueryTypes.SELECT });

    /* --------------------------------------------- active positions ----- */
    /* Matches the "Total active investment" card: confirmed only. */
    const positions = (await q<Record<string, unknown>>(`
        SELECT pi.id_project_investors AS idProjectInvestors,
               COALESCE(u.full_name, CONCAT('User #', u.id_users)) AS investor,
               p.project_name AS project,
               p.investment_type AS investmentType,
               pi.unit_purchased AS units,
               ${AMOUNT} AS capital,
               CASE WHEN b.booking_type = 'reinvestment' THEN 0 ELSE ${AMOUNT} END AS fresh,
               CASE WHEN b.booking_type = 'reinvestment' THEN ${AMOUNT} ELSE 0 END AS rollover,
               pi.actual_profit_amount AS profit,
               COALESCE(b.payment_date, pi.investment_date, pi.created_at) AS investmentDate,
               ${MATURITY} AS maturityDate,
               b.id_project_investment_bookings AS bookingId,
               b.booking_id AS bookingRef
          FROM project_investors pi
          JOIN projects p ON p.id_projects = pi.id_projects
          JOIN users u ON u.id_users = pi.id_users
          LEFT JOIN project_investment_bookings b
                 ON b.id_project_investment_bookings = pi.id_project_investment_bookings
         WHERE pi.investment_status = 'confirmed'
         ORDER BY ${MATURITY} ASC`)).map((r) => ({
        idProjectInvestors: n(r.idProjectInvestors),
        investor: String(r.investor ?? ''),
        project: String(r.project ?? ''),
        investmentType: (r.investmentType as string) ?? null,
        units: n(r.units),
        capital: n(r.capital),
        fresh: n(r.fresh),
        rollover: n(r.rollover),
        profit: r.profit == null ? null : n(r.profit),
        investmentDate: iso(r.investmentDate),
        maturityDate: iso(r.maturityDate),
        bookingId: r.bookingId == null ? null : n(r.bookingId),
        bookingRef: (r.bookingRef as string) ?? null,
    }));

    /* ------------------------------------------------ payout queue ------ */
    /* Matches the "Matured, awaiting payout" card: confirmed and past due. */
    const payouts = (await q<Record<string, unknown>>(`
        SELECT pi.id_project_investors AS idProjectInvestors,
               COALESCE(u.full_name, CONCAT('User #', u.id_users)) AS investor,
               p.project_name AS project,
               ${AMOUNT} AS capital,
               ${AMOUNT} * p.return_range_min / 100 AS profit,
               ${MATURITY} AS maturityDate,
               b.id_project_investment_bookings AS bookingId,
               b.booking_id AS bookingRef
          FROM project_investors pi
          JOIN projects p ON p.id_projects = pi.id_projects
          JOIN users u ON u.id_users = pi.id_users
          LEFT JOIN project_investment_bookings b
                 ON b.id_project_investment_bookings = pi.id_project_investment_bookings
         WHERE pi.investment_status = 'confirmed'
           AND ${MATURITY} <= CURDATE()
         ORDER BY ${MATURITY} ASC`)).map((r) => ({
        idProjectInvestors: n(r.idProjectInvestors),
        investor: String(r.investor ?? ''),
        project: String(r.project ?? ''),
        capital: n(r.capital),
        profit: n(r.profit),
        totalPayable: n(r.capital) + n(r.profit),
        maturityDate: iso(r.maturityDate),
        bookingId: r.bookingId == null ? null : n(r.bookingId),
        bookingRef: (r.bookingRef as string) ?? null,
    }));

    /* --------------------------------------- pending confirmations ------ */
    /*
     * The amount is summed from the booking's investments rather than read from
     * `payment_amount`, which is only written when an admin confirms — so on a
     * pending booking it is always NULL. Reading it is what made the investor's
     * own list show BDT 0.
     */
    const pending = (await q<Record<string, unknown>>(`
        SELECT b.id_project_investment_bookings AS idProjectInvestmentBookings,
               b.booking_id AS bookingRef,
               COALESCE(u.full_name, CONCAT('User #', u.id_users)) AS investor,
               COALESCE((
                   SELECT SUM(pi2.unit_purchased * p2.unit_investment_value)
                     FROM project_investors pi2
                     JOIN projects p2 ON p2.id_projects = pi2.id_projects
                    WHERE pi2.id_project_investment_bookings = b.id_project_investment_bookings
               ), 0) AS amount,
               b.payment_method AS method,
               b.payment_confirmation_status AS status,
               b.created_at AS submittedAt
          FROM project_investment_bookings b
          JOIN users u ON u.id_users = b.id_users
         WHERE b.cancelled = 'no'
           AND b.payment_confirmation_status IN ('pending', 'uploaded', 'proof_submitted')
         ORDER BY b.created_at DESC`)).map((r) => ({
        idProjectInvestmentBookings: n(r.idProjectInvestmentBookings),
        bookingRef: String(r.bookingRef ?? ''),
        investor: String(r.investor ?? ''),
        amount: n(r.amount),
        method: (r.method as string) ?? null,
        status: String(r.status ?? ''),
        submittedAt: iso(r.submittedAt),
    }));

    /* ---------------------------------------------- active investors ---- */
    const investors = (await q<Record<string, unknown>>(`
        SELECT u.id_users AS idUsers,
               COALESCE(u.full_name, CONCAT('User #', u.id_users)) AS investor,
               u.phone_number AS phone,
               COUNT(*) AS positions,
               SUM(${AMOUNT}) AS totalCapital,
               COALESCE(SUM(CASE WHEN ${MATURITY} <= CURDATE() THEN ${AMOUNT} END), 0) AS maturedPending,
               GROUP_CONCAT(DISTINCT p.project_name ORDER BY p.project_name SEPARATOR ', ') AS projects
          FROM project_investors pi
          JOIN projects p ON p.id_projects = pi.id_projects
          JOIN users u ON u.id_users = pi.id_users
          LEFT JOIN project_investment_bookings b
                 ON b.id_project_investment_bookings = pi.id_project_investment_bookings
         WHERE pi.investment_status IN ('confirmed', 'booked')
         GROUP BY u.id_users, u.full_name, u.phone_number
         ORDER BY totalCapital DESC`)).map((r) => ({
        idUsers: n(r.idUsers),
        investor: String(r.investor ?? ''),
        phone: (r.phone as string) ?? null,
        positions: n(r.positions),
        totalCapital: n(r.totalCapital),
        maturedPending: n(r.maturedPending),
        projects: String(r.projects ?? ''),
    }));

    return { positions, payouts, pending, investors };
}
