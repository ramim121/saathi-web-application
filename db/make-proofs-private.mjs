/**
 * Removes public read access from every existing proof-of-payment object.
 *
 * WHY
 * The upload handlers set `ACL: 'public-read'`, so every bank receipt, deposit
 * slip and cheque image uploaded so far is readable by anyone with the URL —
 * verified by an anonymous request returning 200. The handlers no longer set
 * that ACL, but objects already in the bucket keep the grant they were written
 * with. This retrofits them.
 *
 *   node db/make-proofs-private.mjs --dry-run   # list what would change
 *   node db/make-proofs-private.mjs             # apply
 *
 * It reads the filenames from the database rather than listing the bucket, so
 * it only ever touches objects this application created.
 *
 * After it runs, the images are served by
 * `/api/files/proof-of-payment/{bookingId}`, which checks ownership and issues
 * a five-minute presigned URL. The admin panel already points there.
 *
 * Safe to re-run: setting an ACL that is already `private` is a no-op.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
import {
    S3Client,
    PutObjectAclCommand,
    GetObjectAclCommand,
} from "@aws-sdk/client-s3";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");
const dryRun = process.argv.includes("--dry-run");

/**
 * --revert puts the objects back to public-read.
 *
 * Needed because staging and production **share this bucket**, and staging was
 * seeded from a production dump, so the filenames are the same rows. Making
 * them private therefore also hid them from the production admin panel, which
 * still reads the public bucket URL. Until the fixed admin panel is deployed to
 * production, public is the state that keeps that screen working.
 *
 * Re-run without the flag once the deploy lands.
 */
const revert = process.argv.includes("--revert");
const targetAcl = revert ? "public-read" : "private";

function readEnv() {
    const file = path.join(root, ".env");
    if (!fs.existsSync(file)) throw new Error("No .env found.");
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

const env = readEnv();

const s3 = new S3Client({
    region: env.S3_BUCKET_REGION,
    credentials: {
        accessKeyId: env.S3_BUCKET_ACCESS_KEY,
        secretAccessKey: env.S3_BUCKET_SECRET_KEY,
    },
});

const connection = await mysql.createConnection({
    host: env.DB_HOST,
    port: Number(env.DB_PORT || 3306),
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
});

const [rows] = await connection.query(
    "SELECT DISTINCT proof_of_payment AS f FROM project_investment_bookings WHERE proof_of_payment IS NOT NULL AND proof_of_payment <> ''",
);
await connection.end();

console.log(`${rows.length} proof object(s) referenced by the database${dryRun ? "  (DRY RUN)" : ""}\n`);

let changed = 0;
let alreadyPrivate = 0;
let missing = 0;

for (const row of rows) {
    const Key = `proof-of-payment/${row.f}`;
    try {
        const acl = await s3.send(
            new GetObjectAclCommand({ Bucket: env.S3_BUCKET_NAME, Key }),
        );
        const isPublic = (acl.Grants ?? []).some(
            (grant) => grant.Grantee?.URI?.includes("AllUsers"),
        );

        // Already in the state we want.
        if (isPublic === revert) {
            alreadyPrivate += 1;
            continue;
        }

        if (dryRun) {
            changed += 1;
            console.log(`  +  ${Key} would become ${targetAcl}`);
            continue;
        }

        await s3.send(
            new PutObjectAclCommand({ Bucket: env.S3_BUCKET_NAME, Key, ACL: targetAcl }),
        );
        changed += 1;
        console.log(`  +  ${Key} set to ${targetAcl}`);
    } catch (error) {
        // A row can reference a file that was never uploaded, or was removed.
        // That is not a failure of this script.
        missing += 1;
        console.log(`  !  ${Key} — ${error.name}`);
    }
}

console.log(
    `\n${dryRun ? "Would change" : "Changed"} ${changed}, already private ${alreadyPrivate}, unreadable ${missing}.`,
);
