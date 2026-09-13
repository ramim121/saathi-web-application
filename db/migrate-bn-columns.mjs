/**
 * Applies db/migrations/002_bangla_columns.sql through the mysql2 driver.
 *
 * WHY THIS EXISTS
 * The .sql file defines a `add_column_if_missing` stored procedure so it can be
 * re-run safely. Creating that procedure needs `DELIMITER`, which is a construct
 * of the mysql *command-line client*, not of MySQL itself — the driver cannot
 * execute the file as written. Rather than keep two copies of the column list
 * and let them drift, this script parses the `CALL add_column_if_missing(...)`
 * lines straight out of the .sql and performs the same
 * check-then-add for each one.
 *
 * Safe to re-run: a column that already exists is skipped, not re-added.
 * Safe on a live database: every column is nullable with no default, which is an
 * INSTANT operation on MySQL 8, and code already deployed never selects these
 * columns so it is unaffected.
 *
 *   node db/migrate-bn-columns.mjs           # apply
 *   node db/migrate-bn-columns.mjs --dry-run # show what would change
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const sqlPath = path.join(here, "migrations", "002_bangla_columns.sql");
const dryRun = process.argv.includes("--dry-run");

/** Minimal .env reader — this runs outside Next, so nothing loads .env for us. */
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
        // Strip surrounding quotes (the Apple key is stored quoted).
        if (value.length > 1 && value[0] === '"' && value.at(-1) === '"') {
            value = value.slice(1, -1);
        }
        out[line.slice(0, i)] = value;
    }
    return out;
}

/**
 * Pulls the column list out of the .sql, resolving the @vc / @vc100 / @txt
 * type variables it defines, so the .sql stays the single source of truth.
 */
function parseColumns(sql) {
    const types = {};
    for (const m of sql.matchAll(/SET\s+@(\w+)\s*=\s*'([^']+)'\s*;/g)) {
        types[m[1]] = m[2];
    }

    const columns = [];
    for (const m of sql.matchAll(
        /CALL\s+add_column_if_missing\(\s*'([^']+)'\s*,\s*'([^']+)'\s*,\s*@(\w+)\s*\)/g,
    )) {
        const [, table, column, typeVar] = m;
        const definition = types[typeVar];
        if (!definition) throw new Error(`Unknown type variable @${typeVar} for ${table}.${column}`);
        columns.push({ table, column, definition });
    }
    return columns;
}

const env = readEnv();
const columns = parseColumns(fs.readFileSync(sqlPath, "utf8"));
console.log(`Parsed ${columns.length} columns from 002_bangla_columns.sql`);

const connection = await mysql.createConnection({
    host: env.DB_HOST,
    port: Number(env.DB_PORT || 3306),
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
});

console.log(`Connected to ${env.DB_NAME}${dryRun ? "  (DRY RUN — no changes)" : ""}\n`);

let added = 0;
let skipped = 0;
const missingTables = [];

try {
    for (const { table, column, definition } of columns) {
        const [tableRows] = await connection.query(
            "SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?",
            [table],
        );
        if (tableRows.length === 0) {
            missingTables.push(table);
            console.log(`  !  ${table}.${column} — table does not exist, skipping`);
            continue;
        }

        const [rows] = await connection.query(
            "SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",
            [table, column],
        );

        if (rows.length > 0) {
            skipped += 1;
            console.log(`  =  ${table}.${column} already present`);
            continue;
        }

        if (dryRun) {
            added += 1;
            console.log(`  +  ${table}.${column} would be added`);
            continue;
        }

        // Identifiers cannot be parameterised. They come from our own .sql file,
        // never from user input, and are constrained to [A-Za-z0-9_] below.
        if (!/^[A-Za-z0-9_]+$/.test(table) || !/^[A-Za-z0-9_]+$/.test(column)) {
            throw new Error(`Refusing unsafe identifier: ${table}.${column}`);
        }

        await connection.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
        added += 1;
        console.log(`  +  ${table}.${column} added`);
    }

    console.log(
        `\n${dryRun ? "Would add" : "Added"} ${added}, already present ${skipped}, of ${columns.length}.`,
    );
    if (missingTables.length) {
        console.log(`Tables not found: ${[...new Set(missingTables)].join(", ")}`);
    }
} finally {
    await connection.end();
}
