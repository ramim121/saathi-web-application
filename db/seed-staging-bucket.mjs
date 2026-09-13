/**
 * Copies existing objects into the staging bucket so staging can display them.
 *
 * WHY
 * Staging was given its own bucket (`saathi-staging-2026`) to stop it writing
 * into production storage. But the staging *database* is a copy of production's,
 * so every row still points at filenames that only exist in the old bucket —
 * and a brand-new bucket is empty. The result is a working app with no images
 * anywhere.
 *
 * This copies server-side (`CopyObject`), so nothing is downloaded to or
 * uploaded from this machine.
 *
 * SENSITIVE PREFIXES ARE SKIPPED BY DEFAULT
 * `nid/` and `proof-of-payment/` hold national ID cards and bank receipts for
 * real people. Duplicating them into a second bucket doubles the number of
 * places that data can leak from, for the sake of a test environment — so they
 * are excluded unless you explicitly ask for them.
 *
 * To exercise NID or proof-of-payment display in staging, upload your own
 * through the app: those writes go to the staging bucket and will display
 * normally.
 *
 *   node db/seed-staging-bucket.mjs --dry-run
 *   node db/seed-staging-bucket.mjs
 *   node db/seed-staging-bucket.mjs --include-sensitive   # copies nid/ too
 *
 * Safe to re-run: an object that already exists in the destination is skipped.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
    S3Client,
    ListObjectsV2Command,
    CopyObjectCommand,
    HeadObjectCommand,
} from "@aws-sdk/client-s3";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, "..");

const dryRun = process.argv.includes("--dry-run");
const includeSensitive = process.argv.includes("--include-sensitive");

/** Where the objects actually are today. */
const SOURCE_BUCKET = process.env.SOURCE_BUCKET ?? "saathi-production-2025";

/**
 * Prefixes skipped unless --include-sensitive is passed.
 *
 * Override with SKIP_PREFIXES when the destination genuinely needs some of
 * them — repairing `saathi-files-new` needs `nid/` (a user reviews their own
 * submitted ID on the profile screen) but not `proof-of-payment/` (the app
 * never displays a receipt back, so copying those would duplicate bank
 * documents for nothing).
 */
const SENSITIVE_PREFIXES = (process.env.SKIP_PREFIXES ?? "nid/,proof-of-payment/")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

function readEnv() {
    const file = path.join(root, ".env");
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
/**
 * Defaults to the bucket in .env, overridable for one-off repairs — notably
 * back-filling `saathi-files-new`, which the shipped app still reads and which
 * stopped receiving uploads when the API moved to `saathi-production-2025`.
 */
const DEST_BUCKET = process.env.DEST_BUCKET ?? env.S3_BUCKET_NAME;

if (DEST_BUCKET === SOURCE_BUCKET) {
    console.error(
        `Refusing to run: .env still points at ${SOURCE_BUCKET}, which is the source.\n` +
            `Set S3_BUCKET_NAME to the staging bucket first.`,
    );
    process.exit(1);
}

const s3 = new S3Client({
    region: env.S3_BUCKET_REGION,
    credentials: {
        accessKeyId: env.S3_BUCKET_ACCESS_KEY,
        secretAccessKey: env.S3_BUCKET_SECRET_KEY,
    },
});

console.log(`source : ${SOURCE_BUCKET}`);
console.log(`dest   : ${DEST_BUCKET}${dryRun ? "   (DRY RUN)" : ""}`);
console.log(
    `sensitive prefixes (${SENSITIVE_PREFIXES.join(", ")}): ${
        includeSensitive ? "INCLUDED" : "skipped"
    }\n`,
);

let copied = 0;
let skippedExisting = 0;
let skippedSensitive = 0;
let failed = 0;
let token;

do {
    const page = await s3.send(
        new ListObjectsV2Command({ Bucket: SOURCE_BUCKET, ContinuationToken: token }),
    );

    for (const object of page.Contents ?? []) {
        const Key = object.Key;

        if (!includeSensitive && SENSITIVE_PREFIXES.some((p) => Key.startsWith(p))) {
            skippedSensitive += 1;
            continue;
        }

        // Directory placeholder objects have nothing to copy.
        if (Key.endsWith("/")) continue;

        try {
            await s3.send(new HeadObjectCommand({ Bucket: DEST_BUCKET, Key }));
            skippedExisting += 1;
            continue;
        } catch {
            // Not there yet — fall through and copy.
        }

        if (dryRun) {
            copied += 1;
            continue;
        }

        try {
            await s3.send(
                new CopyObjectCommand({
                    Bucket: DEST_BUCKET,
                    Key,
                    /*
                     * Encode each path segment, not the whole key.
                     *
                     * `encodeURIComponent(Key)` also encodes the slashes as
                     * %2F. S3 tolerates that for most keys, which is why the
                     * first pass mostly worked — but keys containing characters
                     * that need escaping came out mangled and were silently not
                     * copied. Segment-wise encoding keeps the path structure
                     * while still escaping the parts that need it.
                     */
                    CopySource: `${SOURCE_BUCKET}/${Key.split("/").map(encodeURIComponent).join("/")}`,
                    // Matches how the app serves these today. The move to
                    // presigned URLs is tracked separately in
                    // docs/s3-object-privacy.md.
                    ACL: "public-read",
                    MetadataDirective: "COPY",
                }),
            );
            copied += 1;
            if (copied % 200 === 0) console.log(`  … ${copied} copied`);
        } catch (error) {
            failed += 1;
            if (failed <= 5) console.log(`  !  ${Key} — ${error.name}`);
        }
    }

    token = page.IsTruncated ? page.NextContinuationToken : undefined;
} while (token);

console.log(
    `\n${dryRun ? "Would copy" : "Copied"} ${copied}, already present ${skippedExisting}, ` +
        `skipped as sensitive ${skippedSensitive}, failed ${failed}.`,
);
