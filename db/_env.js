/**
 * Loads `.env` into `process.env` for scripts run outside Next.
 *
 * Next reads `.env` itself, so the app never needed a loader and `dotenv` is
 * not a dependency. Anything under `db/` that imports `@/config/constants`
 * does need one, because that module throws on a missing variable at import
 * time — by design, so a misconfigured deploy fails at boot rather than at the
 * first request.
 *
 * Preload it, so it runs before any import is resolved:
 *
 *   npx ts-node -r ./db/_env.js -r tsconfig-paths/register …
 *
 * Existing values win, so `FOO=x node …` still overrides the file.
 */
const fs = require('node:fs');
const path = require('node:path');

const file = path.join(__dirname, '..', '.env');

if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
        if (!/^[A-Za-z0-9_]+=/.test(line)) continue;
        const i = line.indexOf('=');
        const key = line.slice(0, i);
        if (process.env[key] !== undefined) continue;

        let value = line.slice(i + 1).trim();
        if (value.length > 1 && value[0] === '"' && value.at(-1) === '"') {
            value = value.slice(1, -1);
        }
        process.env[key] = value;
    }
}
