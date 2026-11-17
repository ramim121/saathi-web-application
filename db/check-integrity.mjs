/**
 * Consistency checks over bookings, investments, partner allocations and
 * projects — the rules the money depends on.
 *
 * READ-ONLY. It runs inside a READ ONLY transaction and writes nothing.
 *
 *   node db/check-integrity.mjs                      # uses .env (on the server: that folder's database)
 *   node db/check-integrity.mjs --env .env.production.local
 *   node db/check-integrity.mjs --json
 *
 * Each rule reports PASS, FAIL (the records contradict each other — money or
 * units do not add up), WARN (probably wrong, needs a human), or INFO (worth
 * knowing, not an error). Exit code 1 when anything FAILs.
 *
 * WHY THESE RULES
 * Written on 2026-11-17 after a hand edit to a project's price (to make one
 * reinvestment compute) silently halved the amounts shown to every other
 * investor in that project, and after rollovers entered as fresh bookings left
 * capital showing as owed. The records that matter most:
 *
 *   project_partner_investors.amount_invested / invested_unit — what was paid,
 *     per partner. The source of truth for money.
 *   project_investors.unit_purchased / investment_status — the line.
 *   project_investment_bookings — the booking, its payment and, for a
 *     reinvestment, the line it was funded from (id_source_project_investors).
 *   projects.unit_investment_value — the price TODAY; not a record of the past.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const args = process.argv.slice(2);
const asJson = args.includes("--json");
const envFile = args.includes("--env") ? args[args.indexOf("--env") + 1] : ".env";

function readEnv(file) {
    const out = {};
    for (const line of fs.readFileSync(path.resolve(root, file), "utf8").split(/\r?\n/)) {
        if (!/^[A-Za-z0-9_]+=/.test(line)) continue;
        const i = line.indexOf("=");
        let value = line.slice(i + 1).trim();
        if (value.length > 1 && /^["']/.test(value) && value.at(-1) === value[0]) value = value.slice(1, -1);
        out[line.slice(0, i)] = value;
    }
    return out;
}

/** Capital of a line: what its partner allocations recorded. */
const CAPITAL = `(SELECT SUM(x.amount_invested) FROM project_partner_investors x WHERE x.id_project_investors = pi.id_project_investors)`;
/** End of a line's term: payment date (or investment date) plus the project's duration. */
const MATURITY = `CASE p.tenure WHEN 'years' THEN DATE_ADD(COALESCE(b.payment_date, pi.investment_date), INTERVAL p.duration YEAR)
                  ELSE DATE_ADD(COALESCE(b.payment_date, pi.investment_date), INTERVAL p.duration MONTH) END`;
const LIVE = `('confirmed','booked','request_withdrawal','ready_for_withdrawal')`;

const RULES = [
    // ---- the records agree with each other --------------------------------
    ["FAIL", "Every investment line has a partner allocation", `
        SELECT pi.id_project_investors AS line, pi.id_project_investment_bookings AS booking, pi.investment_status AS status
          FROM project_investors pi LEFT JOIN project_partner_investors ppi ON ppi.id_project_investors = pi.id_project_investors
         WHERE ppi.id_project_partner_investors IS NULL`],
    ["FAIL", "A line's units equal its partners' units", `
        SELECT pi.id_project_investors AS line, pi.unit_purchased AS units, SUM(ppi.invested_unit) AS partner_units
          FROM project_investors pi JOIN project_partner_investors ppi ON ppi.id_project_investors = pi.id_project_investors
         GROUP BY pi.id_project_investors HAVING SUM(ppi.invested_unit) <> pi.unit_purchased`],
    ["FAIL", "No partner allocation without its line", `
        SELECT ppi.id_project_partner_investors AS allocation, ppi.id_project_investors AS missing_line
          FROM project_partner_investors ppi LEFT JOIN project_investors pi ON pi.id_project_investors = ppi.id_project_investors
         WHERE pi.id_project_investors IS NULL`],
    ["FAIL", "Every booking has at least one investment line", `
        SELECT b.booking_id FROM project_investment_bookings b
          LEFT JOIN project_investors pi ON pi.id_project_investment_bookings = b.id_project_investment_bookings
         WHERE pi.id_project_investors IS NULL`],
    ["FAIL", "Every investment line belongs to a booking that exists", `
        SELECT pi.id_project_investors AS line FROM project_investors pi
          LEFT JOIN project_investment_bookings b ON b.id_project_investment_bookings = pi.id_project_investment_bookings
         WHERE b.id_project_investment_bookings IS NULL`],
    ["FAIL", "A booking and its lines belong to the same investor", `
        SELECT b.booking_id, b.id_users AS booking_user, pi.id_users AS line_user FROM project_investment_bookings b
          JOIN project_investors pi ON pi.id_project_investment_bookings = b.id_project_investment_bookings WHERE b.id_users <> pi.id_users`],
    ["FAIL", "Booking numbers are unique", `
        SELECT booking_id, COUNT(*) AS n FROM project_investment_bookings GROUP BY booking_id HAVING COUNT(*) > 1`],
    ["FAIL", "No zero or negative units or amounts", `
        SELECT 'line units' AS what, pi.id_project_investors AS id FROM project_investors pi WHERE pi.unit_purchased <= 0
        UNION ALL SELECT 'allocation units', ppi.id_project_partner_investors FROM project_partner_investors ppi WHERE ppi.invested_unit <= 0
        UNION ALL SELECT 'allocation amount', ppi.id_project_partner_investors FROM project_partner_investors ppi WHERE ppi.amount_invested <= 0`],
    ["WARN", "A line's partners belong to the line's project", `
        SELECT pi.id_project_investors AS line, b.booking_id, pi.id_projects AS line_project, pp.id_projects AS partner_project, ppi.id_project_partners AS partner
          FROM project_partner_investors ppi JOIN project_investors pi ON pi.id_project_investors = ppi.id_project_investors
          JOIN project_investment_bookings b ON b.id_project_investment_bookings = pi.id_project_investment_bookings
          LEFT JOIN project_partners pp ON pp.id_project_partners = ppi.id_project_partners
         WHERE pp.id_project_partners IS NULL OR pp.id_projects <> pi.id_projects`],

    // ---- booking state and line state agree ---------------------------------
    ["FAIL", "Booking status and line status agree", `
        SELECT b.booking_id, b.payment_confirmation_status AS payment, b.cancelled, pi.id_project_investors AS line, pi.investment_status AS line_status
          FROM project_investment_bookings b JOIN project_investors pi ON pi.id_project_investment_bookings = b.id_project_investment_bookings
         WHERE (b.payment_confirmation_status = 'confirmed' AND b.cancelled = 'no' AND pi.investment_status IN ('booked','cancelled'))
            OR (b.payment_confirmation_status <> 'confirmed' AND pi.investment_status NOT IN ('booked','cancelled'))
            OR (b.cancelled = 'yes' AND pi.investment_status <> 'cancelled')
            OR (b.cancelled = 'no' AND b.payment_confirmation_status <> 'denied' AND pi.investment_status = 'cancelled')`],

    // ---- reinvestments --------------------------------------------------------
    ["FAIL", "A reinvestment is funded by a reinvested line of the same investor", `
        SELECT b.booking_id, b.id_source_project_investors AS source, s.id_users AS source_user, b.id_users AS user, s.investment_status AS source_status
          FROM project_investment_bookings b LEFT JOIN project_investors s ON s.id_project_investors = b.id_source_project_investors
         WHERE b.booking_type = 'reinvestment' AND b.cancelled = 'no'
           AND (s.id_project_investors IS NULL OR s.id_users <> b.id_users OR s.investment_status NOT LIKE 'reinvested%')`],
    ["FAIL", "Each reinvested line funds exactly one reinvestment", `
        SELECT s.id_project_investors AS line, s.investment_status AS status,
               (SELECT COUNT(*) FROM project_investment_bookings b WHERE b.id_source_project_investors = s.id_project_investors AND b.cancelled = 'no') AS funded
          FROM project_investors s WHERE s.investment_status LIKE 'reinvested%'
        HAVING funded <> 1`],
    ["WARN", "Reinvested amount = source capital (capital only) or capital + profit (full)", `
        SELECT b.booking_id, s.id_project_investors AS source, s.investment_status AS kind, b.reinvested_amount,
               (SELECT SUM(x.amount_invested) FROM project_partner_investors x WHERE x.id_project_investors = s.id_project_investors) AS capital, s.actual_profit_amount AS profit
          FROM project_investment_bookings b JOIN project_investors s ON s.id_project_investors = b.id_source_project_investors
         WHERE b.booking_type = 'reinvestment' AND b.cancelled = 'no'
        HAVING ABS(reinvested_amount - (capital + CASE WHEN kind = 'reinvested_full' THEN IFNULL(profit,0) ELSE 0 END)) > 0.5`],
    ["WARN", "Rollover entered as a fresh booking while the matured line is still in the payout queue", `
        SELECT nb.booking_id AS new_booking, ob.booking_id AS matured_booking, n.id_users AS user, n.unit_purchased AS units, n.investment_date
          FROM project_investors n
          JOIN project_investment_bookings nb ON nb.id_project_investment_bookings = n.id_project_investment_bookings AND nb.booking_type = 'fresh' AND nb.cancelled = 'no'
          JOIN project_investors o ON o.id_users = n.id_users AND o.id_projects = n.id_projects AND o.id_project_investors <> n.id_project_investors
                                  AND o.unit_purchased = n.unit_purchased AND o.investment_status IN ('ready_for_withdrawal','request_withdrawal')
          JOIN projects p ON p.id_projects = o.id_projects
          JOIN project_investment_bookings ob ON ob.id_project_investment_bookings = o.id_project_investment_bookings
         WHERE n.investment_date = DATE_ADD(o.investment_date, INTERVAL p.duration MONTH)`],

    // ---- capacity -------------------------------------------------------------
    ["FAIL", "No partner holds more confirmed units than its capacity", `
        SELECT pp.id_project_partners AS partner, pp.id_projects AS project, pp.partner_unit_capacity AS capacity, SUM(ppi.invested_unit) AS confirmed_units
          FROM project_partners pp JOIN project_partner_investors ppi ON ppi.id_project_partners = pp.id_project_partners
          JOIN project_investors pi ON pi.id_project_investors = ppi.id_project_investors
         WHERE pi.investment_status = 'confirmed' GROUP BY pp.id_project_partners
        HAVING pp.partner_unit_capacity > 0 AND SUM(ppi.invested_unit) > pp.partner_unit_capacity`],
    ["FAIL", "No project holds more confirmed units than it offers", `
        SELECT p.id_projects AS project, p.total_available_units AS available, SUM(pi.unit_purchased) AS confirmed_units
          FROM projects p JOIN project_investors pi ON pi.id_projects = p.id_projects AND pi.investment_status = 'confirmed'
         GROUP BY p.id_projects HAVING p.total_available_units > 0 AND SUM(pi.unit_purchased) > p.total_available_units`],
    ["WARN", "No investor holds more active units in a project than the per-investor limit", `
        SELECT pi.id_users AS user, p.id_projects AS project, p.investor_unit_capacity AS per_investor, SUM(pi.unit_purchased) AS active_units
          FROM project_investors pi JOIN projects p ON p.id_projects = pi.id_projects
         WHERE pi.investment_status = 'confirmed' GROUP BY pi.id_users, p.id_projects
        HAVING p.investor_unit_capacity > 0 AND SUM(pi.unit_purchased) > p.investor_unit_capacity`],

    // ---- money ----------------------------------------------------------------
    ["WARN", "Confirmed fresh booking: amount received = amount booked", `
        SELECT b.booking_id, b.payment_amount AS received,
               (SELECT SUM(x.amount_invested) FROM project_partner_investors x JOIN project_investors y ON y.id_project_investors = x.id_project_investors
                 WHERE y.id_project_investment_bookings = b.id_project_investment_bookings) AS booked, b.transaction_id
          FROM project_investment_bookings b
         WHERE b.payment_confirmation_status = 'confirmed' AND b.cancelled = 'no' AND b.booking_type = 'fresh'
        HAVING received IS NULL OR ABS(received - booked) > 0.5`],
    ["WARN", "Recorded profit = capital x recorded %", `
        SELECT pi.id_project_investors AS line, pi.investment_status AS status, pi.actual_profit_percentage AS pct, pi.actual_profit_amount AS profit,
               ROUND(${CAPITAL} * pi.actual_profit_percentage / 100, 2) AS expected
          FROM project_investors pi
         WHERE pi.actual_profit_amount IS NOT NULL AND pi.actual_profit_percentage IS NOT NULL
           AND ABS(pi.actual_profit_amount - ${CAPITAL} * pi.actual_profit_percentage / 100) > 1`],
    ["WARN", "Finished lines have their profit recorded", `
        SELECT pi.id_project_investors AS line, pi.investment_status AS status FROM project_investors pi
         WHERE pi.investment_status IN ('withdrawn','reinvested_capital','reinvested_full','ready_for_withdrawal','request_withdrawal')
           AND pi.actual_profit_amount IS NULL`],

    // ---- worth knowing --------------------------------------------------------
    ["INFO", "Lines bought at a different price than the project's price today (repriced projects)", `
        SELECT pi.id_projects AS project, COUNT(*) AS lines_, SUM(${CAPITAL}) AS paid, SUM(pi.unit_purchased * p.unit_investment_value) AS at_todays_price
          FROM project_investors pi JOIN projects p ON p.id_projects = pi.id_projects
         WHERE pi.investment_status <> 'cancelled' AND ABS(${CAPITAL} - pi.unit_purchased * p.unit_investment_value) > 0.5
         GROUP BY pi.id_projects`],
    ["INFO", "Live investments in projects marked completed or closed", `
        SELECT b.booking_id, pi.id_projects AS project, p.project_status, pi.investment_status AS status
          FROM project_investors pi JOIN projects p ON p.id_projects = pi.id_projects
          JOIN project_investment_bookings b ON b.id_project_investment_bookings = pi.id_project_investment_bookings
         WHERE pi.investment_status IN ${LIVE} AND p.project_status IN ('completed','closed')`],
    ["INFO", "Active investments past their maturity date", `
        SELECT b.booking_id, pi.id_project_investors AS line, ${MATURITY} AS matured_on
          FROM project_investors pi JOIN projects p ON p.id_projects = pi.id_projects
          JOIN project_investment_bookings b ON b.id_project_investment_bookings = pi.id_project_investment_bookings
         WHERE pi.investment_status = 'confirmed' AND ${MATURITY} < CURDATE()`],
    ["INFO", "Payout queue (matured, not yet paid)", `
        SELECT b.booking_id, pi.id_users AS user, pi.unit_purchased AS units, ${CAPITAL} AS capital, pi.actual_profit_amount AS profit
          FROM project_investors pi JOIN project_investment_bookings b ON b.id_project_investment_bookings = pi.id_project_investment_bookings
         WHERE pi.investment_status IN ('ready_for_withdrawal','request_withdrawal')`],
];

const env = readEnv(envFile);
const db = await mysql.createConnection({
    host: env.DB_HOST, port: Number(env.DB_PORT || 3306),
    user: env.DB_USER, password: env.DB_PASSWORD, database: env.DB_NAME,
    dateStrings: true,
});
await db.query("SET SESSION TRANSACTION READ ONLY");
await db.query("START TRANSACTION READ ONLY");

const results = [];
for (const [level, name, sql] of RULES) {
    const [rows] = await db.query(sql);
    results.push({ level: rows.length ? level : "PASS", rule: name, count: rows.length, rows });
}
await db.query("ROLLBACK");
await db.end();

if (asJson) {
    console.log(JSON.stringify({ database: env.DB_NAME, at: new Date().toISOString(), results }, null, 2));
} else {
    console.log(`Integrity check — ${env.DB_NAME} — ${new Date().toISOString()}\n`);
    for (const r of results) {
        const tag = r.level === "PASS" ? "PASS" : r.level;
        console.log(`${tag.padEnd(4)}  ${r.rule}${r.count ? `  (${r.count})` : ""}`);
        if (r.count) {
            for (const row of r.rows.slice(0, 12)) {
                console.log("        " + Object.entries(row).map(([k, v]) => `${k}=${v}`).join("  "));
            }
            if (r.count > 12) console.log(`        … ${r.count - 12} more`);
        }
    }
    const tally = (l) => results.filter((r) => r.level === l).length;
    console.log(`\n${tally("PASS")} pass, ${tally("FAIL")} fail, ${tally("WARN")} warn, ${tally("INFO")} info`);
}
process.exit(results.some((r) => r.level === "FAIL") ? 1 : 0);
