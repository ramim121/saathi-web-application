/**
 * Runs the four drill-down queries against the configured database and prints
 * their totals beside the tile figures they are supposed to explain.
 *
 * A breakdown that disagrees with its own tile is worse than no breakdown, so
 * this checks the two agree rather than checking the queries merely run.
 *
 *   node db/verify-dashboard-detail.mjs
 */
import mysql from 'mysql2/promise';
/* Side-effect module: it reads ../.env into process.env and exports nothing. */
import './_env.js';

const env = process.env;
const bdt = (n) => `BDT ${Number(n || 0).toLocaleString('en-IN')}`;

const AMOUNT = 'pi.unit_purchased * p.unit_investment_value';
const MATURITY = `
    DATE_ADD(
        COALESCE(b.payment_date, pi.investment_date, pi.created_at),
        INTERVAL CASE WHEN p.tenure = 'years' THEN p.duration * 12 ELSE p.duration END MONTH
    )`;

const db = await mysql.createConnection({
    host: env.DB_HOST,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    port: Number(env.DB_PORT || 3306),
});

const q = async (sql) => (await db.query(sql))[0];

console.log(`\ndatabase: ${env.DB_NAME} @ ${env.DB_HOST}\n`);

/* --- tile figures, as the dashboard computes them ---------------------- */
const [tileActive] = await q(`
    SELECT COUNT(*) AS positions, COALESCE(SUM(${AMOUNT}), 0) AS amt
      FROM project_investors pi
      JOIN projects p ON p.id_projects = pi.id_projects
     WHERE pi.investment_status = 'confirmed'`);

const [tilePayout] = await q(`
    SELECT COUNT(*) AS cnt, COALESCE(SUM(${AMOUNT}), 0) AS amt
      FROM project_investors pi
      JOIN projects p ON p.id_projects = pi.id_projects
      LEFT JOIN project_investment_bookings b
             ON b.id_project_investment_bookings = pi.id_project_investment_bookings
     WHERE pi.investment_status = 'confirmed' AND ${MATURITY} <= CURDATE()`);

const [tilePending] = await q(`
    SELECT COUNT(*) AS cnt
      FROM project_investment_bookings b
     WHERE b.cancelled = 'no'
       AND b.payment_confirmation_status IN ('pending', 'uploaded', 'proof_submitted')`);

const [tileInvestors] = await q(`
    SELECT COUNT(DISTINCT pi.id_users) AS cnt
      FROM project_investors pi
     WHERE pi.investment_status IN ('confirmed', 'booked')`);

/* --- the drill-down rows ---------------------------------------------- */
const positions = await q(`
    SELECT COUNT(*) AS rows_, COALESCE(SUM(${AMOUNT}), 0) AS amt,
           COALESCE(SUM(CASE WHEN b.booking_type = 'reinvestment' THEN ${AMOUNT} ELSE 0 END), 0) AS rollover
      FROM project_investors pi
      JOIN projects p ON p.id_projects = pi.id_projects
      JOIN users u ON u.id_users = pi.id_users
      LEFT JOIN project_investment_bookings b
             ON b.id_project_investment_bookings = pi.id_project_investment_bookings
     WHERE pi.investment_status = 'confirmed'`);

const payouts = await q(`
    SELECT COUNT(*) AS rows_,
           COALESCE(SUM(${AMOUNT} + ${AMOUNT} * p.return_range_min / 100), 0) AS payable
      FROM project_investors pi
      JOIN projects p ON p.id_projects = pi.id_projects
      JOIN users u ON u.id_users = pi.id_users
      LEFT JOIN project_investment_bookings b
             ON b.id_project_investment_bookings = pi.id_project_investment_bookings
     WHERE pi.investment_status = 'confirmed' AND ${MATURITY} <= CURDATE()`);

const pending = await q(`
    SELECT COUNT(*) AS rows_,
           COALESCE(SUM((
               SELECT COALESCE(SUM(pi2.unit_purchased * p2.unit_investment_value), 0)
                 FROM project_investors pi2
                 JOIN projects p2 ON p2.id_projects = pi2.id_projects
                WHERE pi2.id_project_investment_bookings = b.id_project_investment_bookings
           )), 0) AS amt,
           SUM(CASE WHEN b.payment_amount IS NULL THEN 1 ELSE 0 END) AS null_amounts
      FROM project_investment_bookings b
      JOIN users u ON u.id_users = b.id_users
     WHERE b.cancelled = 'no'
       AND b.payment_confirmation_status IN ('pending', 'uploaded', 'proof_submitted')`);

const investors = await q(`
    SELECT COUNT(*) AS rows_, COALESCE(SUM(cap), 0) AS amt FROM (
        SELECT SUM(${AMOUNT}) AS cap
          FROM project_investors pi
          JOIN projects p ON p.id_projects = pi.id_projects
          JOIN users u ON u.id_users = pi.id_users
         WHERE pi.investment_status IN ('confirmed', 'booked')
         GROUP BY u.id_users) g`);

const check = (name, tile, drill, extra = '') => {
    const ok = Number(tile) === Number(drill);
    console.log(
        `  ${ok ? 'OK  ' : 'MISMATCH'}  ${name.padEnd(28)} tile=${String(tile).padEnd(12)} drill=${String(drill).padEnd(12)} ${extra}`,
    );
    return ok;
};

console.log('counts — tile vs the list it opens');
let allOk = true;
allOk = check('Active positions', tileActive.positions, positions[0].rows_) && allOk;
allOk = check('Awaiting payout', tilePayout.cnt, payouts[0].rows_) && allOk;
allOk = check('Pending payments', tilePending.cnt, pending[0].rows_) && allOk;
allOk = check('Active investors', tileInvestors.cnt, investors[0].rows_) && allOk;

console.log('\nmoney totals shown in each modal header');
console.log(`  positions  ${bdt(positions[0].amt)}   (rollover ${bdt(positions[0].rollover)})`);
console.log(`  payouts    ${bdt(payouts[0].payable)} payable`);
console.log(`  pending    ${bdt(pending[0].amt)}   (${pending[0].null_amounts} of ${pending[0].rows_} have no payment_amount stored)`);
console.log(`  investors  ${bdt(investors[0].amt)}`);

console.log(`\n${allOk ? 'every tile agrees with its breakdown' : 'A TILE DISAGREES WITH ITS BREAKDOWN — fix before shipping'}\n`);
await db.end();
process.exit(allOk ? 0 : 1);
