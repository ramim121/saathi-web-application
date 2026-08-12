import { QueryTypes } from 'sequelize';
import sequelize from '@/config/db';

/**
 * The numbers behind the management dashboard.
 *
 * WHY THE MONEY IS DERIVED, NOT READ
 * There is no amount column on `project_investors` or on
 * `project_investment_bookings` — the booking table's `payment_amount` is only
 * filled in when an admin confirms one. Every figure here is therefore
 * `unit_purchased * projects.unit_investment_value`, which is the same rule the
 * app and the website use (BR-06). Reading a column that is usually NULL is how
 * the investor's own booking list came to show BDT 0 for months.
 *
 * WHAT COUNTS AS WHAT
 *   confirmed          money that is in and working
 *   booked             reserved, payment not yet verified
 *   withdrawn          paid back out
 *   reinvested_capital rolled into a new position rather than paid out
 *   cancelled          excluded from every total
 *
 * Each query is written out rather than composed, because a dashboard that
 * quietly reuses a filter is a dashboard where one wrong `WHERE` moves five
 * numbers at once.
 */

/**
 * Which breakdown a tile opens.
 *
 * Named per dataset rather than per card so two cards can open the same list:
 * "Total active investment" and "Fresh capital injected" are two readings of
 * the same set of positions, and showing one list under both is honest —
 * inventing a second, differently-filtered list would not be.
 */
export type Drill = 'positions' | 'payouts' | 'pending' | 'investors';

export type StatCard = {
    label: string;
    value: number;
    /** Rendered under the figure, e.g. "26 confirmed positions". */
    note: string;
    tone: 'brand' | 'good' | 'warn' | 'alert' | 'info';
    money: boolean;
    /** Omitted when a figure has no row-level breakdown worth showing. */
    drill?: Drill;
};

export type PayableWindow = {
    label: string;
    days: number;
    count: number;
    profitOnly: number;
    profitAndCapital: number;
};

export type ProjectRow = {
    idProjects: number;
    projectName: string;
    investmentType: string | null;
    investors: number;
    units: number;
    totalRaised: number;
};

export type MonthRow = { month: string; investments: number; totalRaised: number };
export type TypeRow = { investmentType: string; investors: number; totalRaised: number };
export type PartnerRow = { name: string; investments: number; totalManaged: number };

export type Dashboard = {
    cards: StatCard[];
    payables: PayableWindow[];
    byProject: ProjectRow[];
    byMonth: MonthRow[];
    byType: TypeRow[];
    topPartners: PartnerRow[];
    generatedAt: string;
};

/** MySQL returns DECIMAL as a string; `+` on it concatenates. */
const n = (v: unknown): number => Number(v ?? 0) || 0;

/**
 * Maturity is not stored either — it is the investment date plus the project's
 * tenure. This expression is repeated wherever a window is needed rather than
 * hidden in a view, so the definition is visible next to the number it drives.
 */
const MATURITY = `
    DATE_ADD(
        COALESCE(b.payment_date, pi.investment_date, pi.created_at),
        INTERVAL CASE WHEN p.tenure = 'years' THEN p.duration * 12 ELSE p.duration END MONTH
    )`;

export async function loadDashboard(): Promise<Dashboard> {
    const q = <T extends object>(sql: string, replacements?: Record<string, unknown>) =>
        sequelize.query<T>(sql, { type: QueryTypes.SELECT, replacements });

    /**
     * The first row of an aggregate query.
     *
     * A `SELECT COUNT(*)` always returns exactly one row, but the type system
     * cannot know that, and defaulting to zeroes is better than a dashboard
     * that throws because one aggregate came back empty.
     */
    const one = async <T extends object>(sql: string, fallback: T, replacements?: Record<string, unknown>): Promise<T> =>
        ((await q<T>(sql, replacements))[0] ?? fallback);

    /* ------------------------------------------------------------- cards -- */

    const active = await one<{ amt: string; positions: number }>(`
        SELECT COALESCE(SUM(pi.unit_purchased * p.unit_investment_value), 0) amt,
               COUNT(*) positions
          FROM project_investors pi
          JOIN projects p ON p.id_projects = pi.id_projects
         WHERE pi.investment_status = 'confirmed'`, { amt: '0', positions: 0 });

    // "Fresh" separates new money from capital that was already with us and has
    // simply been rolled into another project. Reporting the two together would
    // overstate what actually came in.
    const fresh = await one<{ amt: string; rolled: string }>(`
        SELECT COALESCE(SUM(CASE WHEN b.booking_type IS NULL OR b.booking_type <> 'reinvestment'
                                 THEN pi.unit_purchased * p.unit_investment_value END), 0) amt,
               COALESCE(SUM(CASE WHEN b.booking_type = 'reinvestment'
                                 THEN pi.unit_purchased * p.unit_investment_value END), 0) rolled
          FROM project_investors pi
          JOIN projects p ON p.id_projects = pi.id_projects
          LEFT JOIN project_investment_bookings b
                 ON b.id_project_investment_bookings = pi.id_project_investment_bookings
         WHERE pi.investment_status IN ('confirmed', 'withdrawn', 'reinvested_capital')`, { amt: '0', rolled: '0' });

    // Positions whose term has already elapsed but which are still marked
    // confirmed — money owed back but not yet paid out.
    const withdrawals = await one<{ amt: string; cnt: number }>(`
        SELECT COALESCE(SUM(pi.unit_purchased * p.unit_investment_value), 0) amt, COUNT(*) cnt
          FROM project_investors pi
          JOIN projects p ON p.id_projects = pi.id_projects
          LEFT JOIN project_investment_bookings b
                 ON b.id_project_investment_bookings = pi.id_project_investment_bookings
         WHERE pi.investment_status = 'confirmed'
           AND ${MATURITY} <= CURDATE()`, { amt: '0', cnt: 0 });

    const pending = await one<{ cnt: number }>(`
        SELECT COUNT(*) cnt
          FROM project_investment_bookings
         WHERE cancelled = 'no'
           AND payment_confirmation_status IN ('pending', 'uploaded', 'proof_submitted')`, { cnt: 0 });

    const investors = await one<{ cnt: number; joined: number }>(`
        SELECT COUNT(DISTINCT pi.id_users) cnt,
               COUNT(DISTINCT CASE WHEN u.created_at >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
                                   THEN pi.id_users END) joined
          FROM project_investors pi
          JOIN users u ON u.id_users = pi.id_users
         WHERE pi.investment_status IN ('confirmed', 'booked')`, { cnt: 0, joined: 0 });

    const cards: StatCard[] = [
        {
            label: 'Total active investment',
            value: n(active.amt),
            note: `${active.positions} confirmed position${active.positions === 1 ? '' : 's'}`,
            tone: 'brand',
            money: true,
            drill: 'positions',
        },
        {
            label: 'Fresh capital injected',
            value: n(fresh.amt),
            note: `Rolled over: BDT ${n(fresh.rolled).toLocaleString('en-IN')}`,
            tone: 'good',
            money: true,
            drill: 'positions',
        },
        {
            label: 'Matured, awaiting payout',
            value: n(withdrawals.amt),
            note: `${withdrawals.cnt} position${withdrawals.cnt === 1 ? '' : 's'} past maturity`,
            tone: 'warn',
            money: true,
            drill: 'payouts',
        },
        {
            label: 'Pending payments',
            value: pending.cnt,
            note: 'bookings awaiting confirmation',
            tone: 'alert',
            money: false,
            drill: 'pending',
        },
        {
            label: 'Active investors',
            value: investors.cnt,
            note: `+${investors.joined} joined this month`,
            tone: 'info',
            money: false,
            drill: 'investors',
        },
    ];

    /* ---------------------------------------------------------- payables -- */
    /*
     * What has to be paid out, and when.
     *
     * Forward-looking only: anything already past maturity is overdue, not
     * forecast, and is counted on the "Matured, awaiting payout" card instead.
     * Without that lower bound every window returned the same set and all four
     * rows read identically.
     *
     * Profit uses the project's minimum return — a forecast of cash leaving the
     * business should be the conservative end of the range.
     */
    const windows: Array<{ label: string; days: number }> = [
        { label: '15 days', days: 15 },
        { label: '30 days', days: 30 },
        { label: '2 months', days: 60 },
        { label: '3 months', days: 90 },
    ];

    const payables: PayableWindow[] = [];
    for (const w of windows) {
        const row = await one<{ cnt: number; capital: string; profit: string }>(`
            SELECT COUNT(*) cnt,
                   COALESCE(SUM(pi.unit_purchased * p.unit_investment_value), 0) capital,
                   COALESCE(SUM(pi.unit_purchased * p.unit_investment_value * p.return_range_min / 100), 0) profit
              FROM project_investors pi
              JOIN projects p ON p.id_projects = pi.id_projects
              LEFT JOIN project_investment_bookings b
                     ON b.id_project_investment_bookings = pi.id_project_investment_bookings
             WHERE pi.investment_status = 'confirmed'
               AND ${MATURITY} >= CURDATE()
               AND ${MATURITY} <= DATE_ADD(CURDATE(), INTERVAL :days DAY)`,
            { cnt: 0, capital: '0', profit: '0' }, { days: w.days });

        payables.push({
            label: w.label,
            days: w.days,
            count: row.cnt,
            profitOnly: n(row.profit),
            profitAndCapital: n(row.capital) + n(row.profit),
        });
    }

    /* ------------------------------------------------------- breakdowns -- */

    const byProject = (await q<{
        idProjects: number; projectName: string; investmentType: string | null;
        investors: number; units: string; totalRaised: string;
    }>(`
        SELECT p.id_projects AS idProjects, p.project_name AS projectName,
               p.investment_type AS investmentType,
               COUNT(DISTINCT pi.id_users) investors,
               COALESCE(SUM(pi.unit_purchased), 0) units,
               COALESCE(SUM(pi.unit_purchased * p.unit_investment_value), 0) totalRaised
          FROM projects p
          JOIN project_investors pi ON pi.id_projects = p.id_projects
         WHERE pi.investment_status IN ('confirmed', 'withdrawn', 'reinvested_capital')
         GROUP BY p.id_projects, p.project_name, p.investment_type
         ORDER BY totalRaised DESC`)).map((r) => ({
        idProjects: r.idProjects,
        projectName: r.projectName,
        investmentType: r.investmentType,
        investors: r.investors,
        units: n(r.units),
        totalRaised: n(r.totalRaised),
    }));

    const byMonth = (await q<{ month: string; investments: number; totalRaised: string }>(`
        SELECT DATE_FORMAT(COALESCE(b.payment_date, pi.investment_date, pi.created_at), '%Y-%m') month,
               COUNT(*) investments,
               COALESCE(SUM(pi.unit_purchased * p.unit_investment_value), 0) totalRaised
          FROM project_investors pi
          JOIN projects p ON p.id_projects = pi.id_projects
          LEFT JOIN project_investment_bookings b
                 ON b.id_project_investment_bookings = pi.id_project_investment_bookings
         WHERE pi.investment_status IN ('confirmed', 'withdrawn', 'reinvested_capital')
           AND COALESCE(b.payment_date, pi.investment_date, pi.created_at)
               >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
         GROUP BY month
         ORDER BY month ASC`)).map((r) => ({
        month: r.month,
        investments: r.investments,
        totalRaised: n(r.totalRaised),
    }));

    const byType = (await q<{ investmentType: string; investors: number; totalRaised: string }>(`
        SELECT COALESCE(p.investment_type, 'unspecified') investmentType,
               COUNT(DISTINCT pi.id_users) investors,
               COALESCE(SUM(pi.unit_purchased * p.unit_investment_value), 0) totalRaised
          FROM project_investors pi
          JOIN projects p ON p.id_projects = pi.id_projects
         WHERE pi.investment_status IN ('confirmed', 'withdrawn', 'reinvested_capital')
         GROUP BY investmentType
         ORDER BY totalRaised DESC`)).map((r) => ({
        investmentType: r.investmentType,
        investors: r.investors,
        totalRaised: n(r.totalRaised),
    }));

    const topPartners = (await q<{ name: string; investments: number; totalManaged: string }>(`
        SELECT COALESCE(u.full_name, CONCAT('Partner #', MIN(pp.id_project_partners))) name,
               COUNT(DISTINCT ppi.id_project_investors) investments,
               COALESCE(SUM(ppi.invested_unit * p.unit_investment_value), 0) totalManaged
          FROM project_partner_investors ppi
          JOIN project_partners pp ON pp.id_project_partners = ppi.id_project_partners
          JOIN projects p ON p.id_projects = pp.id_projects
          JOIN project_investors pi ON pi.id_project_investors = ppi.id_project_investors
          LEFT JOIN users u ON u.id_users = pp.id_users
         WHERE pi.investment_status IN ('confirmed', 'withdrawn', 'reinvested_capital')
         -- By person, not by project assignment. Grouping on
         -- id_project_partners listed anyone working across two projects twice.
         GROUP BY COALESCE(pp.id_users, pp.id_project_partners), u.full_name
         ORDER BY totalManaged DESC
         LIMIT 8`)).map((r) => ({
        name: r.name,
        investments: r.investments,
        totalManaged: n(r.totalManaged),
    }));

    return {
        cards,
        payables,
        byProject,
        byMonth,
        byType,
        topPartners,
        generatedAt: new Date().toISOString(),
    };
}
