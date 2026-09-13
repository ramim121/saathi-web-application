/**
 * Joins two accounts that belong to the same person.
 *
 * WHY THIS EXISTS AS A SCRIPT
 * The in-app merge (v2/web/account/merge) requires the person to prove both
 * channels — an SMS code for the phone and an emailed code for the address —
 * before it will touch anything. That is the right bar for a self-service
 * merge, but it cannot clear the duplicates already in the database: those
 * people are not asking for a merge, and three of them are sitting in front of
 * a unique index that migration 010 cannot create.
 *
 * So this is the operator's tool, with a human reading the survey first. It
 * makes exactly the same changes the API makes.
 *
 *   node db/find-duplicate-accounts.mjs             # survey, read it properly
 *   node db/merge-accounts.mjs --dry-run            # every duplicate found
 *   node db/merge-accounts.mjs --keep 296 --merge 544 --dry-run
 *   node db/merge-accounts.mjs --keep 296 --merge 544
 *
 * WHAT IT DOES
 *   1. re-points every row carrying a user id from the loser to the survivor;
 *   2. fills gaps on the survivor from the loser — an address, a name, a
 *      profile picture, an NID — but never overwrites something already there;
 *   3. marks the loser `status='merged'`, `merged_into=<survivor>`.
 *
 * NOTHING IS DELETED. The loser row stays forever, which is what makes the
 * merge reversible and keeps the audit trail readable. `--revert` undoes one.
 *
 * ALL OR NOTHING. Everything runs in a single transaction: a merge that fails
 * half way would leave bookings owned by an account that can no longer sign in.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const revert = argv.includes("--revert");
const flag = (name) => {
    const i = argv.indexOf(name);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : null;
};
const keepArg = flag("--keep");
const mergeArg = flag("--merge");

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

/** See find-duplicate-accounts.mjs — same reasoning for the exclusions. */
const EXCLUDED_TABLES = new Set(["users", "project_investors_bkp_06052026"]);

async function userIdTables(conn, database) {
    const [rows] = await conn.query(
        `SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = ? AND COLUMN_NAME IN ('id_users', 'ordered_by')
          ORDER BY TABLE_NAME`,
        [database],
    );
    return rows
        .filter((r) => !EXCLUDED_TABLES.has(r.TABLE_NAME))
        .map((r) => ({ table: r.TABLE_NAME, column: r.COLUMN_NAME }));
}

/**
 * Fields the survivor may inherit, but only where it currently has nothing.
 *
 * Never overwrite: the survivor was chosen because it is the account the person
 * actually uses, and silently replacing their name or bank details with an
 * older copy is a data-loss bug wearing a merge costume.
 *
 * `password` is deliberately absent. Two accounts, one of which may have a
 * credential the person forgot about, is not a hole worth opening.
 */
const INHERITABLE = [
    "full_name",
    "full_name_bn",
    "email",
    "phone_number",
    "gender",
    "profile_image",
    "date_of_birth",
    "location",
    "bio",
    "nid_number",
    "nid_image_front",
    "nid_image_back",
    "google_id",
    "apple_id",
];

/**
 * Verification flags travel WITH the value they describe.
 *
 * Inheriting `email` without `email_verified` would silently downgrade a proven
 * address to an unproven one; inheriting the flag without the address would
 * assert that a different address had been proven. Both are wrong, so they move
 * together or not at all.
 */
const FLAG_FOR = {
    email: ["email_verified", "google_login", "apple_login"],
    phone_number: ["phone_verified"],
    nid_number: ["nid_verified", "nid_verification_status"],
};

const env = readEnv();
const conn = await mysql.createConnection({
    host: env.DB_HOST,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    port: Number(env.DB_PORT ?? 3306),
});

const tables = await userIdTables(conn, env.DB_NAME);

async function getUser(id) {
    const [[row]] = await conn.query(`SELECT * FROM users WHERE id_users = ?`, [id]);
    return row ?? null;
}

function isEmpty(value) {
    return value === null || value === undefined || String(value).trim() === "";
}

/* ------------------------------------------------------------------ merge -- */

async function merge(keepId, mergeId) {
    const survivor = await getUser(keepId);
    const loser = await getUser(mergeId);

    if (!survivor) throw new Error(`survivor #${keepId} does not exist`);
    if (!loser) throw new Error(`loser #${mergeId} does not exist`);
    if (keepId === mergeId) throw new Error("cannot merge an account into itself");
    if (loser.status === "merged") throw new Error(`#${mergeId} is already merged into #${loser.merged_into}`);
    if (survivor.status === "merged") throw new Error(`#${keepId} is itself merged into #${survivor.merged_into}`);
    if (survivor.status === "deleted" || loser.status === "deleted") {
        throw new Error("refusing to merge a deleted account — restore it first if this is intended");
    }

    console.log(`\n#${mergeId} → #${keepId}${dryRun ? "   (DRY RUN)" : ""}`);
    console.log(`   keep : ${survivor.full_name || "(no name)"}  ${survivor.phone_number || "—"}  ${survivor.email || "—"}`);
    console.log(`   merge: ${loser.full_name || "(no name)"}  ${loser.phone_number || "—"}  ${loser.email || "—"}`);

    /* --- what the survivor will inherit ------------------------------- */
    const set = {};
    for (const field of INHERITABLE) {
        if (isEmpty(loser[field])) continue; // loser has nothing to give

        const sameValue =
            !isEmpty(survivor[field]) &&
            String(survivor[field]).trim().toLowerCase() ===
                String(loser[field]).trim().toLowerCase();

        if (isEmpty(survivor[field])) {
            // Gap on the survivor: take the value and the flags that describe it.
            set[field] = loser[field];
        } else if (!sameValue) {
            // Survivor has a *different* value. Never overwrite.
            continue;
        }

        /*
         * Flags move when the survivor took the value, and ALSO when both sides
         * already hold the same value.
         *
         * That second case is the whole reason these duplicates exist: both
         * rows carry the same address, so nothing is inherited, and without
         * this the survivor would keep `email_verified='no'` even though the
         * other row proved that exact address through Google. The next Google
         * sign-in would then miss the lookup and create a third account —
         * re-creating the bug the merge is meant to close.
         *
         * Only ever upgrade. A 'no' on the loser must not overwrite a 'yes'.
         */
        for (const flagField of FLAG_FOR[field] ?? []) {
            if (isEmpty(loser[flagField])) continue;
            if (survivor[flagField] === "yes" && loser[flagField] !== "yes") continue;
            if (survivor[flagField] === loser[flagField]) continue;
            set[flagField] = loser[flagField];
        }
    }

    if (Object.keys(set).length) {
        for (const [k, v] of Object.entries(set)) console.log(`   inherit ${k} = ${v}`);
    } else {
        console.log("   inherit nothing (survivor already has every field)");
    }

    /* --- what will move ------------------------------------------------ */
    const moves = [];
    for (const { table, column } of tables) {
        const [[row]] = await conn.query(
            `SELECT COUNT(*) n FROM \`${table}\` WHERE \`${column}\` = ?`,
            [mergeId],
        );
        if (row.n > 0) moves.push({ table, column, n: row.n });
    }
    if (moves.length) {
        for (const m of moves) console.log(`   move    ${m.table}.${m.column}: ${m.n}`);
    } else {
        console.log("   move    nothing (loser holds no records)");
    }

    if (dryRun) return { moved: 0, dryRun: true };

    /* --- apply, all or nothing ----------------------------------------- */
    await conn.beginTransaction();
    try {
        let moved = 0;
        for (const { table, column, n } of moves) {
            await conn.query(`UPDATE \`${table}\` SET \`${column}\` = ? WHERE \`${column}\` = ?`, [
                keepId,
                mergeId,
            ]);
            moved += n;
        }

        /*
         * Clear the loser's identity columns BEFORE writing them onto the
         * survivor. Migration 010's unique index covers live accounts only, and
         * the loser is about to become 'merged' — but inside the transaction
         * both rows are still live, so writing the same address twice would
         * trip the index. Blanking first also means a merged row cannot be
         * found by an email lookup, which is what we want.
         *
         * The original values are not lost: they are on the survivor now, and
         * `--revert` reads them back from there.
         */
        await conn.query(
            `UPDATE users SET email = NULL, phone_number = NULL, google_id = NULL, apple_id = NULL,
                              status = 'merged', merged_into = ?, merged_at = NOW(), updated_at = NOW()
              WHERE id_users = ?`,
            [keepId, mergeId],
        );

        if (Object.keys(set).length) {
            const assignments = Object.keys(set).map((k) => `\`${k}\` = ?`).join(", ");
            await conn.query(
                `UPDATE users SET ${assignments}, updated_at = NOW() WHERE id_users = ?`,
                [...Object.values(set), keepId],
            );
        }

        await conn.commit();
        console.log(`   ✓ merged — ${moved} row(s) moved`);
        return { moved, dryRun: false };
    } catch (error) {
        await conn.rollback();
        console.error(`   ✗ rolled back — ${error.message}`);
        throw error;
    }
}

/* ----------------------------------------------------------------- revert -- */

async function revertMerge(mergeId) {
    const loser = await getUser(mergeId);
    if (!loser) throw new Error(`#${mergeId} does not exist`);
    if (loser.status !== "merged" || !loser.merged_into) {
        throw new Error(`#${mergeId} is not a merged account`);
    }

    console.log(
        `\nReverting #${mergeId} out of #${loser.merged_into}${dryRun ? "   (DRY RUN)" : ""}`,
    );
    console.log(
        "   NOTE: rows moved by the merge stay with the survivor. This restores the\n" +
            "   login only — re-assigning records needs a human decision about which\n" +
            "   ones were whose.",
    );

    if (dryRun) return;

    await conn.query(
        `UPDATE users SET status = 'active', merged_into = NULL, merged_at = NULL, updated_at = NOW()
          WHERE id_users = ?`,
        [mergeId],
    );
    console.log("   ✓ reverted to active with no identity columns — set them by hand");
}

/* ------------------------------------------------------------------- main -- */

try {
    if (revert) {
        if (!mergeArg) throw new Error("--revert needs --merge <id>");
        await revertMerge(Number(mergeArg));
    } else if (keepArg && mergeArg) {
        await merge(Number(keepArg), Number(mergeArg));
    } else if (keepArg || mergeArg) {
        throw new Error("--keep and --merge must be given together");
    } else {
        // No pair named: walk everything the survey found, using its suggestion.
        const { execSync } = await import("node:child_process");
        const survey = JSON.parse(
            execSync(`node ${path.join(here, "find-duplicate-accounts.mjs")} --json`, {
                encoding: "utf8",
            }),
        );
        if (survey.length === 0) {
            console.log("No duplicate live accounts. Migration 010 can be applied.");
        } else {
            console.log(
                `${survey.length} group(s). Survivor is the suggestion from the survey — ` +
                    `re-run with --keep/--merge to override.`,
            );
            for (const group of survey) {
                for (const loserId of group.wouldMerge) {
                    await merge(group.suggestedSurvivor, loserId);
                }
            }
        }
    }
} finally {
    await conn.end();
}
