/**
 * Lists accounts that look like the same person, and what each one holds.
 *
 * WHY
 * Migration 010 adds a unique index over the email and phone of live accounts.
 * It cannot be applied while duplicates exist, and "just delete one" is not an
 * option when either side may hold real bookings. This is the survey you run
 * first: it says which pairs exist, which side is the better survivor, and
 * exactly what would have to move.
 *
 * READ-ONLY. It writes nothing. `merge-accounts.mjs` does the moving.
 *
 *   node db/find-duplicate-accounts.mjs
 *   node db/find-duplicate-accounts.mjs --json    # for piping
 *
 * SURVIVOR CHOICE
 * The suggestion is the account with the most at stake — verified channels
 * first, then financial records, then age. It is a suggestion: a human decides,
 * because the wrong choice moves somebody's investments under a different id.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const asJson = process.argv.includes("--json");

function readEnv() {
    const out = {};
    for (const line of fs.readFileSync(path.join(root, ".env"), "utf8").split(/\r?\n/)) {
        if (!/^[A-Za-z0-9_]+=/.test(line)) continue;
        const i = line.indexOf("=");
        let value = line.slice(i + 1).trim();
        if (value.length > 1 && value[0] === '"' && value.at(-1) === '"') value = value.slice(1, -1);
        out[line.slice(0, i)] = value;
    }
    return out;
}

/**
 * Every table that carries a user id, and the column that carries it.
 *
 * Derived from the live schema rather than hardcoded, because a table added
 * later that this list forgot would be silently left behind by a merge — rows
 * pointing at an account that no longer signs in.
 *
 * `project_investors_bkp_06052026` is deliberately excluded: it is a backup
 * snapshot, and rewriting a backup destroys the thing that makes it useful.
 */
const EXCLUDED_TABLES = new Set(["users", "project_investors_bkp_06052026"]);

async function userIdTables(conn, database) {
    const [rows] = await conn.query(
        `SELECT TABLE_NAME, COLUMN_NAME
           FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = ?
            AND (COLUMN_NAME = 'id_users' OR COLUMN_NAME = 'ordered_by')
          ORDER BY TABLE_NAME`,
        [database],
    );
    return rows
        .filter((r) => !EXCLUDED_TABLES.has(r.TABLE_NAME))
        .map((r) => ({ table: r.TABLE_NAME, column: r.COLUMN_NAME }));
}

/** What this account would take with it into a merge. */
async function holdings(conn, tables, idUsers) {
    const out = {};
    let total = 0;
    for (const { table, column } of tables) {
        const [[row]] = await conn.query(
            `SELECT COUNT(*) n FROM \`${table}\` WHERE \`${column}\` = ?`,
            [idUsers],
        );
        if (row.n > 0) {
            out[table] = row.n;
            total += row.n;
        }
    }
    return { rows: out, total };
}

/**
 * Higher is a better survivor.
 *
 * HOLDINGS DOMINATE, AND THAT IS NOT OBVIOUS
 * The first version of this weighted verified channels highest, on the
 * reasoning that they are what the person signs in with. Run against the real
 * data it chose an account holding *nothing* over one holding two bookings, two
 * investment rows and a bank account — proposing eight writes against money
 * records where zero would do.
 *
 * The flaw: after a merge the survivor holds *both* channels, verified, no
 * matter which side survives. So the channel flags say nothing about the
 * outcome — they only decide which row number is kept. What does differ is how
 * many financial rows have to be rewritten, and the safest merge is the one
 * that rewrites fewest.
 *
 * NID is the exception, and stays heavy: it is an identity decision an admin
 * made about a specific account, with the scan attached to it. Keeping the
 * verified side avoids re-verifying a real person.
 */
function survivorScore(user, holdingTotal) {
    let score = holdingTotal * 100;

    // An admin's identity decision, not a login channel — expensive to recreate.
    if (user.nid_verified === "yes") score += 500;

    // Tie-breaks only, for two accounts that hold the same amount.
    if (user.phone_verified === "yes") score += 10;
    if (user.email_verified === "yes") score += 10;
    if (user.google_login === "yes" || user.apple_login === "yes") score += 5;
    if (user.full_name) score += 1;

    return score;
}

const env = readEnv();
const conn = await mysql.createConnection({
    host: env.DB_HOST,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    port: Number(env.DB_PORT ?? 3306),
});

const tables = await userIdTables(conn, env.DB_NAME);

const FIELDS = `id_users, full_name, email, phone_number, email_verified, phone_verified,
                nid_verified, google_login, apple_login, status, created_at`;

// Only live accounts collide. A 'deleted' or 'merged' row keeping its old
// address is intentional and is exactly what migration 010 permits.
const LIVE = `status IN ('active', 'inactive')`;

const [emailGroups] = await conn.query(
    `SELECT LOWER(TRIM(email)) k, COUNT(*) n FROM users
      WHERE ${LIVE} AND email IS NOT NULL AND TRIM(email) <> ''
      GROUP BY k HAVING n > 1`,
);
const [phoneGroups] = await conn.query(
    `SELECT TRIM(phone_number) k, COUNT(*) n FROM users
      WHERE ${LIVE} AND phone_number IS NOT NULL AND TRIM(phone_number) <> ''
      GROUP BY k HAVING n > 1`,
);

const findings = [];

for (const [channel, groups, where] of [
    ["email", emailGroups, "LOWER(TRIM(email)) = ?"],
    ["phone", phoneGroups, "TRIM(phone_number) = ?"],
]) {
    for (const group of groups) {
        const [users] = await conn.query(
            `SELECT ${FIELDS} FROM users WHERE ${LIVE} AND ${where} ORDER BY created_at`,
            [group.k],
        );

        const enriched = [];
        for (const user of users) {
            const held = await holdings(conn, tables, user.id_users);
            enriched.push({ ...user, holdings: held.rows, holdingTotal: held.total });
        }
        enriched.sort((a, b) => survivorScore(b, b.holdingTotal) - survivorScore(a, a.holdingTotal));

        findings.push({
            channel,
            value: group.k,
            suggestedSurvivor: enriched[0].id_users,
            wouldMerge: enriched.slice(1).map((u) => u.id_users),
            accounts: enriched,
        });
    }
}

if (asJson) {
    console.log(JSON.stringify(findings, null, 2));
} else if (findings.length === 0) {
    console.log("No duplicate live accounts. Migration 010 can be applied.");
} else {
    console.log(`${findings.length} duplicate group(s) across ${tables.length} user-owning tables.\n`);
    for (const f of findings) {
        console.log(`── ${f.channel}: ${f.value}`);
        for (const a of f.accounts) {
            const flags = [
                a.email_verified === "yes" ? "email✓" : null,
                a.phone_verified === "yes" ? "phone✓" : null,
                a.nid_verified === "yes" ? "nid✓" : null,
                a.google_login === "yes" ? "google" : null,
            ]
                .filter(Boolean)
                .join(" ");
            const mark = a.id_users === f.suggestedSurvivor ? "KEEP  " : "merge ";
            console.log(
                `   ${mark} #${String(a.id_users).padEnd(5)} ${(a.full_name || "(no name)").slice(0, 24).padEnd(26)}` +
                    ` ${(a.phone_number || "—").padEnd(14)} ${flags.padEnd(28)} ${a.holdingTotal} row(s)`,
            );
            for (const [table, n] of Object.entries(a.holdings)) {
                console.log(`            ${table}: ${n}`);
            }
        }
        console.log("");
    }
    console.log("Suggested survivor is the account with verified channels and the most records.");
    console.log("Review each one before running merge-accounts.mjs — the choice moves real money records.");
}

await conn.end();
