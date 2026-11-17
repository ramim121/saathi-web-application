import { QueryTypes } from 'sequelize';
import sequelize from '@/config/db';

/**
 * Data behind the investor report (/reports/investors).
 *
 * ONE DEFINITION OF EVERY FIGURE
 * The list and the detail panel are both built by `summarise()` from the same
 * line-level rows, so a number on the left can never disagree with the same
 * number on the right.
 *
 * MONEY IS WHAT WAS RECORDED
 * A line's capital is the sum of its partner allocations
 * (`project_partner_investors.amount_invested`) — what was actually paid — and
 * never units x `projects.unit_investment_value`, which is the price TODAY.
 * Projects are repriced between cycles; reading today's price is how investors
 * in Project Cattle 2 were once shown half of what they had paid. Units x price
 * is used only for a line with no allocation at all (none exist today).
 *
 * The data set is small (hundreds of lines), so the list is one query and the
 * arithmetic happens here, not in SQL.
 */

/** Where one investment line is in its life. */
export type LineState = 'pending' | 'active' | 'matured' | 'paid_out' | 'reinvested' | 'cancelled';
export type NidState = 'approved' | 'pending' | 'rejected' | 'none';

export type LineView = {
    id: number;
    bookingId: number;
    bookingRef: string;
    project: { id: number; name: string; status: string };
    units: number;
    /** Money recorded against this line. */
    capital: number;
    unitPricePaid: number;
    /** `project_investors.investment_status`, unchanged. */
    status: string;
    state: LineState;
    /** Term start (payment date, else investment date) and end, `YYYY-MM-DD`. */
    start: string | null;
    maturity: string | null;
    returnMinPct: number;
    returnMaxPct: number;
    /** Projected profit while the money is still working. */
    expectedProfitMin: number | null;
    expectedProfitMax: number | null;
    /** Profit actually recorded at maturity. */
    profit: number | null;
    profitPct: number | null;
};

export type BookingView = {
    id: number;
    ref: string;
    type: 'fresh' | 'reinvestment';
    state: LineState;
    placedAt: string | null;
    paymentDate: string | null;
    paymentAmount: number | null;
    /** For a reinvestment: the money rolled in from the funding line. */
    reinvestedAmount: number;
    /** For a reinvestment: the booking whose matured line funded it. */
    sourceRef: string | null;
    sourceBookingId: number | null;
    capital: number;
    units: number;
    lines: LineView[];
};

export type InvestorMetrics = {
    /** Working now (confirmed). */
    activeCapital: number;
    expectedProfitMin: number;
    expectedProfitMax: number;
    /** Booked, payment not yet confirmed. */
    pendingAmount: number;
    /** Part of `pendingAmount` that is a rollover, not new money. */
    pendingRollover: number;
    /** Matured, not yet paid out. */
    maturedCapital: number;
    maturedProfit: number;
    /** Every line that was ever confirmed, rollovers included. */
    lifetimeInvested: number;
    /** Money carried from a matured investment into a new one. */
    rolledOver: number;
    /** `lifetimeInvested` less `rolledOver`: money that came in fresh. */
    newMoney: number;
    /** Capital handed back. */
    paidBackCapital: number;
    /** Profit paid out (on withdrawals and capital-only rollovers). */
    profitPaid: number;
    /** Profit rolled into a new investment instead of paid out. */
    profitReinvested: number;
    bookings: { total: number; active: number; pending: number; matured: number; completed: number; cancelled: number };
    projects: number;
    firstInvestedOn: string | null;
    lastActivityAt: string | null;
    nextMaturity: { date: string; ref: string; bookingId: number; amount: number } | null;
};

export type InvestorListItem = {
    id: number;
    name: string;
    phone: string | null;
    email: string | null;
    status: string;
    nid: NidState;
    joinedAt: string | null;
    activeCapital: number;
    lifetimeInvested: number;
    awaitingPayout: number;
    pendingAmount: number;
    activeBookings: number;
    pendingBookings: number;
    maturedBookings: number;
    totalBookings: number;
    lastActivityAt: string | null;
};

export type InvestorDetail = {
    investor: {
        id: number;
        name: string;
        phone: string | null;
        email: string | null;
        status: string;
        nid: NidState;
        joinedAt: string | null;
        gender: string | null;
        location: string | null;
        bank: { bank: string | null; branch: string | null; holder: string | null; accountLast4: string | null } | null;
    };
    metrics: InvestorMetrics;
    bookings: BookingView[];
};

/* ------------------------------------------------------------------ rows -- */

type RawLine = {
    idUsers: number;
    idLine: number;
    idBooking: number;
    bookingRef: string;
    bookingType: string | null;
    paymentStatus: string | null;
    cancelled: string | null;
    placedAt: string | null;
    paymentDate: string | null;
    paymentAmount: string | null;
    reinvestedAmount: string | null;
    sourceLine: number | null;
    idProject: number;
    projectName: string | null;
    projectStatus: string | null;
    unitPrice: string | null;
    returnMin: string | null;
    returnMax: string | null;
    duration: number | null;
    tenure: string | null;
    units: number;
    status: string;
    investmentDate: string | null;
    profit: string | null;
    profitPct: string | null;
    capital: string | null;
};

type RawUser = {
    id: number;
    name: string | null;
    phone: string | null;
    email: string | null;
    status: string;
    nidVerified: string | null;
    nidStatus: string | null;
    joinedAt: string | null;
    gender?: string | null;
    location?: string | null;
};

const LINES_SQL = `
    SELECT pi.id_users AS idUsers, pi.id_project_investors AS idLine,
           b.id_project_investment_bookings AS idBooking, b.booking_id AS bookingRef, b.booking_type AS bookingType,
           b.payment_confirmation_status AS paymentStatus, b.cancelled,
           DATE_FORMAT(b.created_at, '%Y-%m-%dT%H:%i:%sZ') AS placedAt,
           DATE_FORMAT(b.payment_date, '%Y-%m-%d') AS paymentDate,
           b.payment_amount AS paymentAmount, b.reinvested_amount AS reinvestedAmount,
           b.id_source_project_investors AS sourceLine,
           p.id_projects AS idProject, p.project_name AS projectName, p.project_status AS projectStatus,
           p.unit_investment_value AS unitPrice, p.return_range_min AS returnMin, p.return_range_max AS returnMax,
           p.duration, p.tenure,
           pi.unit_purchased AS units, pi.investment_status AS status,
           DATE_FORMAT(pi.investment_date, '%Y-%m-%d') AS investmentDate,
           pi.actual_profit_amount AS profit, pi.actual_profit_percentage AS profitPct,
           a.capital
      FROM project_investors pi
      JOIN project_investment_bookings b ON b.id_project_investment_bookings = pi.id_project_investment_bookings
      JOIN projects p ON p.id_projects = pi.id_projects
      LEFT JOIN (SELECT id_project_investors, SUM(amount_invested) AS capital
                   FROM project_partner_investors GROUP BY id_project_investors) a
             ON a.id_project_investors = pi.id_project_investors`;

const USER_COLUMNS = `
    u.id_users AS id, u.full_name AS name, u.phone_number AS phone, u.email, u.status,
    u.nid_verified AS nidVerified, u.nid_verification_status AS nidStatus,
    DATE_FORMAT(u.created_at, '%Y-%m-%dT%H:%i:%sZ') AS joinedAt`;

/* --------------------------------------------------------------- helpers -- */

const num = (v: unknown): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};
const numOrNull = (v: unknown): number | null => (v === null || v === undefined ? null : num(v));

function nidOf(u: Pick<RawUser, 'nidVerified' | 'nidStatus'>): NidState {
    if (u.nidVerified === 'yes') return 'approved';
    if (u.nidStatus === 'pending') return 'pending';
    if (u.nidStatus === 'rejected') return 'rejected';
    return 'none';
}

function displayName(u: Pick<RawUser, 'id' | 'name' | 'phone'>): string {
    return u.name?.trim() || u.phone || `Investor #${u.id}`;
}

function stateOf(l: RawLine): LineState {
    if (l.cancelled === 'yes' || l.status === 'cancelled' || l.paymentStatus === 'denied') return 'cancelled';
    switch (l.status) {
        case 'confirmed':
            return 'active';
        case 'request_withdrawal':
        case 'ready_for_withdrawal':
            return 'matured';
        case 'withdrawn':
            return 'paid_out';
        case 'reinvested_capital':
        case 'reinvested_full':
            return 'reinvested';
        default:
            return 'pending';
    }
}

/** `YYYY-MM-DD` plus a term, in UTC — the same arithmetic the bookings API uses. */
function addTerm(start: string | null, duration: number | null, tenure: string | null): string | null {
    if (!start || !duration) return null;
    const [y, m, d] = start.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    if (tenure === 'years') date.setUTCFullYear(date.getUTCFullYear() + duration);
    else date.setUTCMonth(date.getUTCMonth() + duration);
    return date.toISOString().slice(0, 10);
}

const todayUtc = () => new Date().toISOString().slice(0, 10);

/** Earlier of two ISO strings, ignoring nulls. */
const minIso = (a: string | null, b: string | null) => (!a ? b : !b ? a : a < b ? a : b);
const maxIso = (a: string | null, b: string | null) => (!a ? b : !b ? a : a > b ? a : b);

/** A booking is as "open" as its most open line. */
const PRECEDENCE: LineState[] = ['pending', 'active', 'matured', 'paid_out', 'reinvested', 'cancelled'];

function toLineView(l: RawLine): LineView {
    const state = stateOf(l);
    const recorded = num(l.capital);
    const capital = recorded > 0 ? recorded : num(l.units) * num(l.unitPrice);
    const start = l.paymentDate || l.investmentDate;
    const returnMinPct = num(l.returnMin);
    const returnMaxPct = num(l.returnMax);
    const working = state === 'active' || state === 'pending';
    return {
        id: l.idLine,
        bookingId: l.idBooking,
        bookingRef: l.bookingRef,
        project: { id: l.idProject, name: l.projectName ?? `Project #${l.idProject}`, status: l.projectStatus ?? '' },
        units: num(l.units),
        capital,
        unitPricePaid: num(l.units) > 0 ? capital / num(l.units) : 0,
        status: l.status,
        state,
        start,
        maturity: addTerm(start, l.duration, l.tenure),
        returnMinPct,
        returnMaxPct,
        expectedProfitMin: working ? (capital * returnMinPct) / 100 : null,
        expectedProfitMax: working ? (capital * returnMaxPct) / 100 : null,
        profit: numOrNull(l.profit),
        profitPct: numOrNull(l.profitPct),
    };
}

function toBookings(rows: RawLine[]): BookingView[] {
    // Funding lines belong to the same investor, so the ref is in this set.
    const refOfLine = new Map(rows.map((r) => [r.idLine, { ref: r.bookingRef, bookingId: r.idBooking }]));
    const byId = new Map<number, BookingView>();
    for (const r of rows) {
        let b = byId.get(r.idBooking);
        if (!b) {
            const source = r.sourceLine ? refOfLine.get(r.sourceLine) : undefined;
            b = {
                id: r.idBooking,
                ref: r.bookingRef,
                type: r.bookingType === 'reinvestment' ? 'reinvestment' : 'fresh',
                state: 'cancelled',
                placedAt: r.placedAt,
                paymentDate: r.paymentDate,
                paymentAmount: numOrNull(r.paymentAmount),
                reinvestedAmount: num(r.reinvestedAmount),
                sourceRef: source?.ref ?? null,
                sourceBookingId: source?.bookingId ?? null,
                capital: 0,
                units: 0,
                lines: [],
            };
            byId.set(r.idBooking, b);
        }
        const line = toLineView(r);
        b.lines.push(line);
        b.capital += line.capital;
        b.units += line.units;
    }
    // Array.from, not spread or for…of: this project compiles to ES5.
    const all = Array.from(byId.values());
    for (const b of all) {
        b.state = PRECEDENCE.find((s) => b.lines.some((l) => l.state === s)) ?? 'cancelled';
    }
    // Newest first.
    return all.sort((a, b) => (b.placedAt ?? '').localeCompare(a.placedAt ?? '') || b.id - a.id);
}

/** Every figure in the report, from one investor's bookings. */
export function summarise(bookings: BookingView[]): InvestorMetrics {
    const m: InvestorMetrics = {
        activeCapital: 0,
        expectedProfitMin: 0,
        expectedProfitMax: 0,
        pendingAmount: 0,
        pendingRollover: 0,
        maturedCapital: 0,
        maturedProfit: 0,
        lifetimeInvested: 0,
        rolledOver: 0,
        newMoney: 0,
        paidBackCapital: 0,
        profitPaid: 0,
        profitReinvested: 0,
        bookings: { total: 0, active: 0, pending: 0, matured: 0, completed: 0, cancelled: 0 },
        projects: 0,
        firstInvestedOn: null,
        lastActivityAt: null,
        nextMaturity: null,
    };
    const projects = new Set<number>();
    const today = todayUtc();
    let upcoming: InvestorMetrics['nextMaturity'] = null;
    let overdue: InvestorMetrics['nextMaturity'] = null;

    for (const b of bookings) {
        m.bookings.total += 1;
        if (b.state === 'active') m.bookings.active += 1;
        else if (b.state === 'pending') m.bookings.pending += 1;
        else if (b.state === 'matured') m.bookings.matured += 1;
        else if (b.state === 'paid_out' || b.state === 'reinvested') m.bookings.completed += 1;
        else m.bookings.cancelled += 1;

        if (b.state !== 'cancelled') m.lastActivityAt = maxIso(m.lastActivityAt, b.placedAt);

        const everConfirmed = b.lines.some((l) => ['active', 'matured', 'paid_out', 'reinvested'].includes(l.state));
        if (b.type === 'reinvestment' && everConfirmed) m.rolledOver += b.reinvestedAmount;
        if (b.type === 'reinvestment' && b.state === 'pending') m.pendingRollover += b.reinvestedAmount;

        for (const l of b.lines) {
            switch (l.state) {
                case 'active':
                    m.activeCapital += l.capital;
                    m.expectedProfitMin += l.expectedProfitMin ?? 0;
                    m.expectedProfitMax += l.expectedProfitMax ?? 0;
                    if (l.maturity) {
                        const candidate = { date: l.maturity, ref: b.ref, bookingId: b.id, amount: l.capital };
                        if (l.maturity >= today) {
                            if (!upcoming || l.maturity < upcoming.date) upcoming = candidate;
                        } else if (!overdue || l.maturity < overdue.date) {
                            overdue = candidate;
                        }
                    }
                    break;
                case 'pending':
                    m.pendingAmount += l.capital;
                    break;
                case 'matured':
                    m.maturedCapital += l.capital;
                    m.maturedProfit += l.profit ?? 0;
                    break;
                case 'paid_out':
                    m.paidBackCapital += l.capital;
                    m.profitPaid += l.profit ?? 0;
                    break;
                case 'reinvested':
                    if (l.status === 'reinvested_full') m.profitReinvested += l.profit ?? 0;
                    else m.profitPaid += l.profit ?? 0;
                    break;
                default:
                    break;
            }
            if (['active', 'matured', 'paid_out', 'reinvested'].includes(l.state)) {
                m.lifetimeInvested += l.capital;
                projects.add(l.project.id);
                m.firstInvestedOn = minIso(m.firstInvestedOn, l.start);
            }
        }
    }

    m.newMoney = Math.max(0, m.lifetimeInvested - m.rolledOver);
    m.projects = projects.size;
    // An active line past its term is the most urgent thing to show.
    m.nextMaturity = overdue ?? upcoming;
    return m;
}

/* ----------------------------------------------------------------- loads -- */

/** Every investor (merged accounts excluded), with their headline figures. */
export async function loadInvestorList(): Promise<InvestorListItem[]> {
    const [users, rows] = await Promise.all([
        sequelize.query<RawUser>(
            `SELECT ${USER_COLUMNS} FROM users u WHERE u.user_type = 'investor' AND u.status <> 'merged'`,
            { type: QueryTypes.SELECT },
        ),
        sequelize.query<RawLine>(LINES_SQL, { type: QueryTypes.SELECT }),
    ]);

    const rowsByUser = new Map<number, RawLine[]>();
    for (const r of rows) {
        const list = rowsByUser.get(r.idUsers);
        if (list) list.push(r);
        else rowsByUser.set(r.idUsers, [r]);
    }

    return users.map((u) => {
        const m = summarise(toBookings(rowsByUser.get(u.id) ?? []));
        return {
            id: u.id,
            name: displayName(u),
            phone: u.phone,
            email: u.email,
            status: u.status,
            nid: nidOf(u),
            joinedAt: u.joinedAt,
            activeCapital: m.activeCapital,
            lifetimeInvested: m.lifetimeInvested,
            awaitingPayout: m.maturedCapital + m.maturedProfit,
            pendingAmount: m.pendingAmount,
            activeBookings: m.bookings.active,
            pendingBookings: m.bookings.pending,
            maturedBookings: m.bookings.matured,
            totalBookings: m.bookings.total,
            lastActivityAt: m.lastActivityAt,
        };
    });
}

/** One investor in full, or null when there is no such investor. */
export async function loadInvestorDetail(id: number): Promise<InvestorDetail | null> {
    if (!Number.isInteger(id) || id <= 0) return null;

    const [users, rows, banks] = await Promise.all([
        sequelize.query<RawUser>(
            `SELECT ${USER_COLUMNS}, u.gender, u.location FROM users u WHERE u.id_users = :id AND u.user_type = 'investor'`,
            { type: QueryTypes.SELECT, replacements: { id } },
        ),
        sequelize.query<RawLine>(`${LINES_SQL} WHERE pi.id_users = :id`, { type: QueryTypes.SELECT, replacements: { id } }),
        sequelize.query<{ bank: string | null; branch: string | null; holder: string | null; account: string | null }>(
            `SELECT bk.bank_name_full AS bank, br.branch_name AS branch, ub.account_holder_name AS holder, ub.account_number AS account
               FROM user_banks ub
               LEFT JOIN banks bk ON bk.id_banks = ub.id_banks
               LEFT JOIN bank_branches br ON br.id_bank_branches = ub.id_bank_branches
              WHERE ub.id_users = :id
              ORDER BY ub.\`default\` = 'yes' DESC, ub.id_user_banks DESC
              LIMIT 1`,
            { type: QueryTypes.SELECT, replacements: { id } },
        ),
    ]);

    const u = users[0];
    if (!u) return null;
    const bookings = toBookings(rows);
    const bank = banks[0];

    return {
        investor: {
            id: u.id,
            name: displayName(u),
            phone: u.phone,
            email: u.email,
            status: u.status,
            nid: nidOf(u),
            joinedAt: u.joinedAt,
            gender: u.gender ?? null,
            location: u.location ?? null,
            // The full account number is on the Users page; a report that may be
            // printed or shared carries only the last four digits.
            bank: bank
                ? { bank: bank.bank, branch: bank.branch, holder: bank.holder, accountLast4: bank.account ? bank.account.slice(-4) : null }
                : null,
        },
        metrics: summarise(bookings),
        bookings,
    };
}
