/**
 * Applies a plain .sql migration through the mysql2 driver.
 *
 *   node db/migrate.mjs db/migrations/001_app_otps.sql
 *   node db/migrate.mjs db/migrations/001_app_otps.sql --dry-run
 *
 * For CI or any machine without the mysql client. It reads `.env` itself,
 * because nothing loads it outside Next.
 *
 * LIMITATION, ON PURPOSE
 * This runner refuses files containing `DELIMITER`, which is a construct of the
 * mysql *command-line client* rather than of MySQL itself — the driver cannot
 * execute them. `002_bangla_columns.sql` is one of those and has its own runner,
 * `db/migrate-bn-columns.mjs`. Failing loudly beats half-applying a file.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const target = args.find((a) => !a.startsWith("--"));

if (!target) {
    console.error("Usage: node db/migrate.mjs <path-to.sql> [--dry-run]");
    process.exit(1);
}

const sqlPath = path.isAbsolute(target) ? target : path.join(root, target);
const sql = fs.readFileSync(sqlPath, "utf8");

if (/^\s*DELIMITER\b/im.test(sql)) {
    console.error(
        `${path.basename(sqlPath)} uses DELIMITER, which the driver cannot execute.\n` +
            `Use its dedicated runner (see db/migrate-bn-columns.mjs) or the mysql client.`,
    );
    process.exit(1);
}

function readEnv() {
    const file = path.join(root, ".env");
    if (!fs.existsSync(file)) {
        throw new Error("No .env found. Copy .env.example to .env and fill it in.");
    }
    const out = {};
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
        if (!/^[A-Za-z0-9_]+=/.test(line)) continue;
        const i = line.indexOf("=");
        let value = line.slice(i + 1).trim();
        if (value.length > 1 && value[0] === '"' && value.at(-1) === '"') value = value.slice(1, -1);
        out[line.slice(0, i)] = value;
    }
    return out;
}

/** Strips comments, then splits on `;`. Adequate because DELIMITER is rejected above. */
function statements(text) {
    return text
        .split(/\r?\n/)
        .filter((line) => !/^\s*--/.test(line))
        .join("\n")
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean);
}

const env = readEnv();
const parts = statements(sql);

console.log(`${path.basename(sqlPath)}: ${parts.length} statement(s)${dryRun ? "  (DRY RUN)" : ""}`);

const connection = await mysql.createConnection({
    host: env.DB_HOST,
    port: Number(env.DB_PORT || 3306),
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
});

try {
    for (const [i, statement] of parts.entries()) {
        const preview = statement.replace(/\s+/g, " ").slice(0, 90);
        if (dryRun) {
            console.log(`  .  [${i + 1}] ${preview}…`);
            continue;
        }
        await connection.query(statement);
        console.log(`  +  [${i + 1}] ${preview}…`);
    }
    console.log(dryRun ? "\nNothing executed." : "\nDone.");
} finally {
    await connection.end();
}
