/**
 * Replaces the main image of each live project with new card artwork.
 *
 * WHY
 * The images on file are promotional banners with the project name, unit price
 * and return band printed into the artwork. They were produced for a different
 * context, and on a website card they fight the card's own layout — the return
 * figure had to be moved out of the image area because the two collided. They
 * also carry text that no longer matches once a price changes.
 *
 * These replacements are plain photographs: no text, no numbers, no logos, and
 * no identifiable faces.
 *
 * ⚠️  THE IMAGES ARE ILLUSTRATIVE, NOT DOCUMENTARY.
 *    They are generated, not photographs of the actual project sites. That is
 *    fine for card art and is what the previous banners were too, but it must
 *    not be presented as a picture of the specific farm an investor is funding.
 *    Replace them with real site photographs when those exist.
 *
 * SAFE AND REVERSIBLE
 * The previous `file_name` of every row is written to
 * db/project-image-backup.json before anything changes, and `--revert` puts
 * them back. The old S3 objects are never deleted.
 *
 *   node db/replace-project-images.mjs --dry-run
 *   node db/replace-project-images.mjs
 *   node db/replace-project-images.mjs --revert
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import sharp from 'sharp';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const dryRun = process.argv.includes('--dry-run');
const revert = process.argv.includes('--revert');
const BACKUP = path.join(here, 'project-image-backup.json');

/** Which generated file belongs to which project. */
const MAPPING = [
    { idProjects: 45, name: 'Project Potato 02', file: '2026-08-12T13-17-55-editorial-agricultural-photograph-landsc.png' },
    { idProjects: 48, name: 'Project Sack Ginger 2', file: '2026-08-12T13-19-05-editorial-agricultural-photograph-landsc.png' },
    { idProjects: 49, name: 'Project Cattle 03', file: '2026-08-12T13-20-10-editorial-agricultural-photograph-landsc.png' },
    { idProjects: 50, name: 'Project Cattle 04', file: '2026-08-12T13-21-10-editorial-agricultural-photograph-landsc.png' },
    { idProjects: 51, name: 'Project Paddy 01', file: '2026-08-12T13-22-11-editorial-agricultural-photograph-landsc.png' },
    { idProjects: 53, name: 'Shathi Inclusive Feed Mill Project', file: '2026-08-12T13-23-28-editorial-industrial-photograph-landscap.png' },
];

const SOURCE_DIR = process.env.IMAGE_DIR ?? 'C:/Users/ramim/Pictures/claude-images';

function readEnv() {
    const out = {};
    for (const line of fs.readFileSync(path.join(root, '.env'), 'utf8').split(/\r?\n/)) {
        if (!/^[A-Za-z0-9_]+=/.test(line)) continue;
        const i = line.indexOf('=');
        let v = line.slice(i + 1).trim();
        if (v.length > 1 && v[0] === '"' && v.at(-1) === '"') v = v.slice(1, -1);
        out[line.slice(0, i)] = v;
    }
    return out;
}

const env = readEnv();
const s3 = new S3Client({
    region: env.S3_BUCKET_REGION,
    credentials: { accessKeyId: env.S3_BUCKET_ACCESS_KEY, secretAccessKey: env.S3_BUCKET_SECRET_KEY },
});
const conn = await mysql.createConnection({
    host: env.DB_HOST, user: env.DB_USER, password: env.DB_PASSWORD, database: env.DB_NAME,
});

console.log(`bucket : ${env.S3_BUCKET_NAME}`);
console.log(`db     : ${env.DB_NAME} @ ${env.DB_HOST}`);
console.log(`mode   : ${revert ? 'REVERT' : dryRun ? 'DRY RUN' : 'APPLY'}\n`);

/* ----------------------------------------------------------------- revert -- */

if (revert) {
    if (!fs.existsSync(BACKUP)) {
        console.error('No backup file — nothing to revert.');
        process.exit(1);
    }
    const saved = JSON.parse(fs.readFileSync(BACKUP, 'utf8'));
    for (const row of saved) {
        await conn.query('UPDATE files SET file_name = ?, thumbnail = ? WHERE id_files = ?', [
            row.fileName, row.thumbnail, row.idFiles,
        ]);
        console.log(`  restored id_files=${row.idFiles} -> ${row.fileName}`);
    }
    await conn.end();
    console.log('\nReverted. The new objects are still in S3 but unreferenced.');
    process.exit(0);
}

/* ------------------------------------------------------------------ apply -- */

const backup = [];

for (const item of MAPPING) {
    const [rows] = await conn.query(
        `SELECT f.id_files, f.file_name, f.thumbnail, f.ref_type, f.ref_id
           FROM files f
          WHERE f.ref_type = 'project-main-image' AND f.ref_id = ?
          ORDER BY f.id_files DESC LIMIT 1`,
        [item.idProjects],
    );

    if (rows.length === 0) {
        console.log(`  ${item.name}: no project-main-image row — skipped`);
        continue;
    }

    const row = rows[0];
    const source = path.join(SOURCE_DIR, item.file);
    if (!fs.existsSync(source)) {
        console.log(`  ${item.name}: source image missing — skipped (${item.file})`);
        continue;
    }

    /*
     * JPEG, not the original PNG.
     *
     * The generated files are ~2.7 MB each. Next resizes on request, but the
     * origin still fetches the full object from S3 on a cache miss, and these
     * are card images. 1600px wide at quality 82 lands around 300 KB with no
     * visible difference at card size.
     */
    const buffer = await sharp(source)
        .resize({ width: 1600, withoutEnlargement: true })
        .jpeg({ quality: 82, mozjpeg: true })
        .toBuffer();

    // Same naming shape as the existing rows: a hex hash plus extension.
    const fileName = crypto.createHash('sha256')
        .update(item.file + Date.now() + item.idProjects)
        .digest('hex') + '.jpeg';

    const key = `${row.ref_type}/${row.ref_id}/${fileName}`;

    console.log(`  ${item.name}`);
    console.log(`     ${(fs.statSync(source).size / 1048576).toFixed(1)} MB png -> ${(buffer.length / 1024).toFixed(0)} KB jpeg`);
    console.log(`     key ${key}`);
    console.log(`     replaces ${row.file_name}`);

    backup.push({
        idFiles: row.id_files,
        idProjects: item.idProjects,
        fileName: row.file_name,
        thumbnail: row.thumbnail,
    });

    if (dryRun) continue;

    await s3.send(new PutObjectCommand({
        Bucket: env.S3_BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: 'image/jpeg',
        ACL: 'public-read',
        CacheControl: 'public, max-age=31536000, immutable',
    }));

    // The thumbnail column points at a separate object that we are not
    // regenerating; clearing it makes the reader fall back to `file_name`
    // rather than serving the old banner as a thumbnail.
    await conn.query('UPDATE files SET file_name = ?, thumbnail = NULL, updated_at = NOW() WHERE id_files = ?', [
        fileName, row.id_files,
    ]);
    console.log('     updated\n');
}

if (!dryRun && backup.length) {
    fs.writeFileSync(BACKUP, JSON.stringify(backup, null, 2));
    console.log(`Backup of previous file names: ${BACKUP}`);
    console.log('Revert with:  node db/replace-project-images.mjs --revert');
}

await conn.end();
