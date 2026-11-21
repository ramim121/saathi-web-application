import { QueryTypes } from 'sequelize';
import sequelize from '@/config/db';
import { summarizeWindows, windowFor, type HeldBalance, type PayableRow, type PayablesReport } from '@/utils/payablesShared';

/**
 * What the company has to pay investors, position by position.
 *
 * Capital comes from the recorded partner allocations, not units × today's
 * price: a project's price can change after someone invested. Profit is the
 * project's return range until an admin enters the actual figure.
 *
 * "Today" is the date in Bangladesh. The database clock is UTC, so for the
 * first six hours of each Dhaka day CURDATE() is still yesterday.
 */

const MATURITY = `
    DATE_ADD(
        COALESCE(b.payment_date, pi.investment_date, pi.created_at),
        INTERVAL CASE WHEN p.tenure = 'years' THEN p.duration * 12 ELSE p.duration END MONTH
    )`;

const n = (v: unknown) => Number(v ?? 0) || 0;
const money = (v: number) => Math.round(v * 100) / 100;

export function dhakaToday(): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}

const dayNumber = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / 86400000;

export async function loadPayables(): Promise<PayablesReport> {
    const today = dhakaToday();
    const rows = await sequelize.query<Record<string, unknown>>(
        `SELECT pi.id_project_investors AS idProjectInvestors,
                b.id_project_investment_bookings AS idBooking,
                b.booking_id AS bookingRef,
                b.booking_type AS bookingType,
                u.id_users AS idUsers,
                COALESCE(u.full_name, CONCAT('User #', u.id_users)) AS investor,
                u.phone_number AS phone,
                p.id_projects AS idProjects,
                p.project_name AS project,
                pi.investment_status AS status,
                pi.unit_purchased AS units,
                COALESCE(a.amount, pi.unit_purchased * p.unit_investment_value) AS capital,
                COALESCE(a.partners, '') AS partners,
                pi.actual_profit_amount AS actualProfit,
                p.return_range_min AS returnMin,
                p.return_range_max AS returnMax,
                DATE_FORMAT(COALESCE(b.payment_date, pi.investment_date, pi.created_at), '%Y-%m-%d') AS startDate,
                DATE_FORMAT(${MATURITY}, '%Y-%m-%d') AS dueDate
           FROM project_investors pi
           JOIN projects p ON p.id_projects = pi.id_projects
           JOIN users u ON u.id_users = pi.id_users
           LEFT JOIN project_investment_bookings b ON b.id_project_investment_bookings = pi.id_project_investment_bookings
           LEFT JOIN (
               SELECT ppi.id_project_investors,
                      SUM(ppi.amount_invested) AS amount,
                      GROUP_CONCAT(DISTINCT pu.full_name ORDER BY pu.full_name SEPARATOR ', ') AS partners
                 FROM project_partner_investors ppi
                 JOIN project_partners pp ON pp.id_project_partners = ppi.id_project_partners
                 LEFT JOIN users pu ON pu.id_users = pp.id_users
                GROUP BY ppi.id_project_investors
           ) a ON a.id_project_investors = pi.id_project_investors
          WHERE pi.investment_status IN ('confirmed', 'ready_for_withdrawal', 'request_withdrawal')
          ORDER BY dueDate ASC, pi.id_project_investors ASC`,
        { type: QueryTypes.SELECT },
    );

    const payable: PayableRow[] = rows.map((r) => {
        const capital = n(r.capital);
        const profitFinal = r.actualProfit !== null && r.actualProfit !== undefined && r.status !== 'confirmed';
        const minProfit = profitFinal ? n(r.actualProfit) : money((capital * n(r.returnMin)) / 100);
        const maxProfit = profitFinal ? n(r.actualProfit) : money((capital * n(r.returnMax)) / 100);
        const dueDate = String(r.dueDate ?? today);
        const daysLeft = dayNumber(dueDate) - dayNumber(today);
        return {
            idProjectInvestors: n(r.idProjectInvestors),
            idBooking: r.idBooking === null || r.idBooking === undefined ? null : n(r.idBooking),
            bookingRef: (r.bookingRef as string) ?? null,
            idUsers: n(r.idUsers),
            investor: String(r.investor ?? ''),
            phone: (r.phone as string) ?? null,
            idProjects: n(r.idProjects),
            project: String(r.project ?? ''),
            partners: String(r.partners ?? ''),
            status: String(r.status ?? ''),
            source: r.bookingType === 'reinvestment' ? 'Rollover' : 'Fresh',
            units: n(r.units),
            capital,
            minProfit,
            maxProfit,
            profitFinal,
            minTotal: money(capital + minProfit),
            maxTotal: money(capital + maxProfit),
            startDate: (r.startDate as string) ?? null,
            dueDate,
            daysLeft,
            window: windowFor(String(r.status), daysLeft),
        };
    });

    const heldRows = await sequelize.query<Record<string, unknown>>(
        `SELECT e.id_users AS idUsers, COALESCE(u.full_name, CONCAT('User #', e.id_users)) AS investor,
                u.phone_number AS phone, SUM(e.amount) AS balance
           FROM investor_balance_entries e
           JOIN users u ON u.id_users = e.id_users
          GROUP BY e.id_users, u.full_name, u.phone_number
         HAVING balance > 0.004
          ORDER BY balance DESC`,
        { type: QueryTypes.SELECT },
    );
    const held: HeldBalance[] = heldRows.map((r) => ({
        idUsers: n(r.idUsers),
        investor: String(r.investor ?? ''),
        phone: (r.phone as string) ?? null,
        balance: n(r.balance),
    }));

    return {
        today,
        rows: payable,
        windows: summarizeWindows(payable),
        held,
        heldTotal: money(held.reduce((sum, h) => sum + h.balance, 0)),
        generatedAt: new Date().toISOString(),
    };
}
