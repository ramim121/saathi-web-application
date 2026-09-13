# Security remediation — runbook

Two halves:

- **Part A — code**, already applied in this working tree. Review the diff.
- **Part B — credential rotation**, which only you can do. Nothing in Part A
  protects anything until Part B is done, because the old JWT secret is public
  and lets anyone mint an admin token.

Do them in the order below. Part A is deployed *after* Part B's env file is in
place, or the app will refuse to boot — that refusal is intentional.

---

## Part A — code changes applied

| Change | Files |
|---|---|
| Removed every hardcoded secret fallback; missing env vars now throw on startup | `src/config/constants.ts` |
| Documented every variable | `.env.example` (new) |
| Shared `requireUser` / `requireAdmin` / `withOptionalUser` / `canAccess` guards + a real CORS allowlist | `src/utils/auth.ts` (new) |
| Bank update: added auth **and** an ownership check | `src/pages/api/banks/update/[id].ts` |
| Bank read by user id: added auth + ownership | `src/pages/api/user-bank/[id].ts` |
| Bank edit prefill: added auth + ownership | `src/pages/api/banks/edit-info/[id].ts` |
| Blog delete: now admin-only | `src/pages/api/blogs/delete/[id].ts` |
| Partner detach: now admin-only; also fixed a transaction that never rolled back on error | `src/pages/api/projects/delete-partner-assign/[id].ts` |
| OTP moved to the database, hashed, attempt-limited, timing-safe compare; hardcoded bypass removed | `src/pages/api/otp.ts`, `src/models/AppOtp.ts` (new), `db/migrations/001_app_otps.sql` (new) |
| `OTP_EXPIRY` corrected to 5 minutes and parsed as a number | `src/config/constants.ts` |
| `API_URL` no longer points at localhost | `src/config/constants.ts` |
| Proof-of-payment upload: added an ownership check — any signed-in user could attach a payment file, method and bank account to **someone else's booking** | `src/pages/api/bookings/proof-of-payment-upload/[id].ts` |
| Public partner projections reduced to an explicit allowlist | `src/utils/publicFields.ts` (new), `partners/get_all_partners.ts`, `top_partners.ts`, `projects/details/[id].ts`, `projects/project-partners/[id].ts` |
| Add-bank-account: added a missing `await` on the clear-other-defaults update, which raced the insert and could leave two accounts flagged default | `src/pages/api/banks/user-bank.ts` |
| `/users` page: added an SSR admin guard — it queried Sequelize in `getServerSideProps` with no auth, so an anonymous GET received all 426 user rows in `__NEXT_DATA__` | `src/utils/pageAuth.ts` (new), `src/pages/users.tsx` |
| `orderBy` query parameter validated against the model's own attributes in all 12 list handlers | `src/utils/order.ts` (new), the 12 `*/list.ts` handlers |
| Order direction clamped instead of interpolated (knex escapes the column, not the direction) | `src/pages/api/orders/index.ts` |
| `/projects/details/[id]` returns 404 instead of a 500 crash when the project does not exist | `src/pages/projects/details/[id].tsx` |

### `JWT_SECRET` thrown in the browser — a regression from this work, now fixed

Removing the hardcoded fallbacks made `config/constants.ts` throw when a value
is missing. That is right on the server and wrong in a browser, and **31 admin
pages imported `API_URL` / `S3_URL` from it** — so the entire secrets module was
compiled into the client bundles. In the browser `process.env` does not exist,
so `required("JWT_SECRET")` threw:

```
Unhandled Runtime Error
Error: Missing required environment variable: JWT_SECRET.
  src/config/constants.ts (19:10) @ required
```

`.env` was complete and the server was fine the whole time. Confirmed by
searching the compiled output: `.next/static/chunks/pages/{login,users,
projects/list,blogs/create}.js` each contained the module.

**No secret was ever exposed.** Next inlines only `NEXT_PUBLIC_*` into client
code, so the browser's copy of `process.env` held nothing — which is precisely
why the lookup failed and it threw.

Three changes:

| | |
|---|---|
| `src/config/public.ts` (new) — client-safe `API_URL` / `S3_URL`, static `process.env.NEXT_PUBLIC_*` reads, never throws | all 31 pages import from here now |
| `required()` returns `""` instead of throwing when it runs in a browser — the server still fails loudly on a genuinely missing variable | `src/config/constants.ts` |
| `API_URL` now defaults to `/` (same origin) | see below |

`API_URL` had **no server-side uses at all**: all 27 call sites are pages doing
`API_URL + "api/…"` — the admin UI calling its own Next app. The old default was
the absolute production origin, so the panel made cross-origin requests that
only worked because CORS was `*`, and a stale value pointed the browser at a
host that was not serving the panel. Same-origin is what the code already
assumed. Override with `NEXT_PUBLIC_API_URL` only if the panel is ever served
from a different host than the API.

Add to the server `.env` (both are documented in `.env.example`):

```
NEXT_PUBLIC_API_URL=/
NEXT_PUBLIC_S3_URL=https://<bucket>.s3.<region>.amazonaws.com/
```

**Rule going forward: a page or component may import `@/config/public`, never
`@/config/constants`.** The second one is server-only, and importing it from a
page is what caused this.

One further regression surfaced by the same sweep and fixed with it:
`bookings/create.tsx` called `api/user/investors` with **no token**, and Phase A
had locked that route to admin — so the manual-booking page showed
"Authentication required" instead of the investor dropdown. It now sends
`getRequestOptions()`. Every other tokenless call on that page
(`get_projects_for_investment`, `project-partners/{id}`, `all_skills`,
`get_all_categories`, `get_all_unit`, `investment_plans`) was probed
unauthenticated and returns 200, so this was the only one.

### The `/users` page — an unauthenticated dump of the user table

Worth calling out separately, because it is the most exposed thing found so far
and it is not an API route, which is where the audit had been looking.

`src/pages/users.tsx` ran `User.findAll({ include: [UserBank, Bank, BankBranch] })`
inside `getServerSideProps`. Whatever that returns is serialised into the
`__NEXT_DATA__` script tag of the served HTML, so the client-side layout's
token check never enters into it — the data is in the response before any
JavaScript runs. Measured against the local server pointed at the production
database:

```
GET /users            (no cookie, no token)  ->  200
users: 426
keys: idUsers, fullName, email, phoneNumber, nidNumber, nidImageFront,
      nidImageBack, dateOfBirth, googleId, appleId, ... , UserBanks
rows with bank data: 36
```

`password` was excluded, again by the model's `defaultScope`. Everything else
was readable by anyone who could reach the URL.

The fix is `requireAdminPage()` in `src/utils/pageAuth.ts`, which reads the
`saathi-token` cookie (a document request carries no `Authorization` header),
verifies it, and redirects non-admins to `/login`. Verified after the change:
anonymous gets `307 -> /login` with no user data in the body; an admin cookie
still renders all 426 rows.

**Any future page that queries the database in `getServerSideProps` needs the
same guard.** There are three such pages today; `index.tsx` returns no data and
`projects/details/[id].tsx` is admin-navigated project data.

### The four open endpoints — resolved by audit

`saathi-mobile-app` was scanned for callers. The finding that drove the
decision is in `src/utility/fetch.tsx`: every helper except `PutWithOutToken`
attaches `Authorization` unconditionally (sending `Bearer null` when logged
out), and `Get` / `Post` / `PostFile` / `deleteData` all treat a **401 as a
forced logout** — they clear the stored token, emit `onLogout` and alert
"Token Not Found. Please login again." `Get` does the same on a **500**.

So locking an endpoint the shipped app calls would not merely break a screen;
it would eject users mid-session. Outcome:

| Endpoint | App callers | Action |
|---|---|---|
| `/api/user/investors` | **none** | ✅ Locked in place → admin |
| `/api/investors/invested-projects/[id]` | `MyInvestedProjects`, `MyInvestment`, `PendingProofOfPaymentList` | ⏸ Left as-is. New `/api/v2/investments/mine` added — same payload, user id from the token instead of the URL |
| `/api/bookings/details/[id]` | `OrderDetails`, `MyOrderDetails` | ⏸ Left as-is. Website will use an ownership-checked v2 route |
| `/api/partners/get_all_partners` | `PartnersScreen` (a bottom tab, possibly reachable before login) | ✅ Projection trimmed, route left open — see below |

Retire each original once the app ships a build pointing at v2.

### Partner personal data on public endpoints — resolved

`get_all_partners` called `User.findAll()` with **no `attributes` option at all**,
so Sequelize returned every column of the `users` row to anonymous callers. A
live probe of the test API confirmed it:

```
GET https://api-test.digigramventures.com/api/partners/get_all_partners  ->  200, 36 rows
top-level keys: idUsers, fullName, email, phoneNumber, ..., nidNumber,
                nidImageFront, nidImageBack, nidVerified, nidVerificationStatus,
                googleId, appleId, dateOfBirth, ...
phoneNumber populated on 36/36 rows
```

`password` was **not** exposed — the User model carries
`defaultScope: { attributes: { exclude: ['password'] } }`. The NID and email
columns were null on the test database, but they are in the projection, so they
would serialise the moment a production row has them.

The fix is an explicit allowlist in `src/utils/publicFields.ts`
(`PUBLIC_PARTNER_ATTRIBUTES`), applied to every public partner projection:

| Route | Auth | Change |
|---|---|---|
| `partners/get_all_partners` | public | Allowlist added — drops email, phoneNumber, NID columns, verification flags, googleId/appleId, dateOfBirth, status |
| `top_partners` | public | `phoneNumber` removed |
| `projects/details/[id]` (both partner projections) | public | `phoneNumber` removed |
| `projects/project-partners/[id]` | public | `phoneNumber` removed |
| `partners/list` | **admin-gated already** | Unchanged — this is the admin app's partner phone number |

Two fields were deliberately **kept**:

- **`disability`** — the shipped mobile app renders it as a badge
  (`PartnersScreen`, `PartnerList`), shows it on the partner profile, and filters
  on it via `?disability=yes`. Removing it breaks live screens. It is inclusion
  data partners are presented under rather than a hidden attribute, but it is
  the one line in the allowlist worth revisiting if that framing changes.
- **`phoneNumber` in `partners/list`** — admin-only and confirmed in use.

`projects/project-partners/[id]` is still unauthenticated. It could be locked to
admin — no mobile screen calls it — except that `src/pages/bookings/create.tsx`
fetches it **without** `getRequestOptions()`, so it sends no token. Fix that
caller first, then gate the route.

### Still open — needs your decision

- **Proof-of-payment files are uploaded to S3 with `ACL: 'public-read'`**
  (`bookings/proof-of-payment-upload/[id].ts`, key prefix `proof-of-payment/`).
  These are bank transfer receipts, deposit slips and cheque images — they
  should not be world-readable. The filename is a hash, so it is not trivially
  enumerable, but "unguessable URL" is not an access control. Recommend
  switching this prefix to private objects served through presigned URLs, the
  way NID scans already are. This changes how the app renders the proof
  thumbnail, so it needs an app release — hence it is listed here rather than
  patched.
- `bookings/details/{id}` is unauthenticated and takes the booking id from the
  URL, so any booking is readable by id. Cannot be locked in place (the live app
  calls it from `OrderDetails` and `MyOrderDetails`, and a 401 force-logs-out the
  user). Phase F adds an ownership-checked v2 route; the website must use that
  one and never the original.
- `src/models/__sync.ts` calls `.sync({ force: true })` on every table — a
  drop-all-data script sitting in the repo. It has no npm script pointing at it,
  but it should be deleted or renamed to something that cannot be run by accident.
- `next@13.5.6` has a published security advisory. Upgrade to a patched 13.x.

---

## Part B — credential rotation

Every value below was committed to a GitHub repo. Treat all of them as known to
an attacker. Rotate in this order — the JWT secret last, because it forces every
user to sign in again and you want everything else already working.

### B1. Database (RDS MySQL)

1. In RDS, create a new user with the same grants as the current one, or change
   the existing user's password.
2. Put the new value in `DB_PASSWORD` on the server's `.env`.
3. Confirm the security group does not allow `0.0.0.0/0` on 3306. If it does,
   restrict it to the application host — the credentials being public means the
   database was reachable by anyone who could route to it.

### B2. AWS S3 (`saathi-production-2025`)

The exposed key can read, write and delete the bucket — which stores **NID scans
and selfies**.

1. IAM → the user behind `S3_BUCKET_ACCESS_KEY` → create a second access key.
2. Put it in `.env`, deploy, confirm uploads still work.
3. **Deactivate** the old key, wait, then **delete** it.
4. Review CloudTrail / S3 access logs for reads you cannot account for. If the
   repo was ever public, assume the bucket was enumerated.
5. Confirm the bucket blocks public access and that NID objects are private —
   they are served through presigned URLs, so they should not be public-read.

### B3. AWS SES

Same rotate-verify-delete cycle as B2 for `SES_AWS_ACCESS_KEY_ID`. Check the
SES sending statistics for volume you did not send; a leaked SES key is
routinely used for phishing that then damages your sending reputation.

### B4. BulkSMSBD

Ask BulkSMSBD to reissue the API key. Check the account's SMS balance and
history — a leaked key spends your credit.

### B5. Apple Sign-In private key

1. Apple Developer → Keys → revoke `576Y8AWU3L`.
2. Create a new Sign in with Apple key, download the `.p8` **once**.
3. Set `APPLE_KEY_ID` and `APPLE_PRIVATE_KEY` in `.env` (PEM on one line with
   `\n` escapes; the code expands them).

### B6. Google client ID

A client ID is not secret, so this is low priority. Confirm the OAuth consent
screen's authorised origins do not include anything you no longer control.

### B7. JWT secret — last

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Set `JWT_SECRET`, deploy. **Every existing session is invalidated**: app users
sign in again with an OTP, admins with email + password. Announce it, and do it
at a quiet hour.

There is no refresh-token mechanism, so this is a clean cut rather than a
staged rollover.

### B8. Git history

Rotation is what actually protects you; history cleanup is hygiene. If you want
it clean:

```bash
pip install git-filter-repo
git filter-repo --path src/config/constants.ts --invert-paths
# then re-add the current, secret-free version and force-push
```

Everyone with a clone must re-clone afterwards. If that is disruptive, skip it —
the rotated values make the old ones worthless.

Also confirm whether `github.com/ramim121/saathi-web-application` is public. If
it is, assume automated scanners already harvested every key; GitHub's own
secret scanning would likely have flagged the AWS ones.

---

## Deploy order

1. Run the migrations against the database — all are safe on a live system:
   ```bash
   mysql -h <host> -u <user> -p <database> < db/migrations/001_app_otps.sql
   mysql -h <host> -u <user> -p <database> < db/migrations/003_digigram_bank_details.sql
   ```
   `002_bangla_columns.sql` uses `DELIMITER`, a mysql-CLI construct, so it can
   also be applied through the driver — which is what you want from CI or a
   machine without the mysql client:
   ```bash
   node db/migrate-bn-columns.mjs --dry-run   # show what would change
   node db/migrate-bn-columns.mjs             # apply
   ```
   That runner parses the column list out of the .sql, so the two cannot drift.
   It is idempotent: re-running adds nothing.

   **002 has already been applied to the database in `.env`** (22 columns added,
   MySQL 8.0.45). It had to be: the Sequelize models declare the `*_bn` columns,
   so until the columns existed, every query failed with
   `Unknown column '…_bn' in 'field list'` and every page 500'd.
2. Create `.env` on the server from `.env.example`, filled with the **rotated**
   values. The GitHub Actions workflow rsyncs the working tree and builds on the
   host, so `.env` must exist there before the build. It is gitignored, so it
   will not be overwritten by the rsync.
3. Deploy. The app throws on startup if anything is missing — that is the
   designed behaviour, and the error names the variable.
4. Smoke test in this order: request an OTP, verify it, admin login, an image
   upload, a booking confirmation email.

## Verification

```bash
# Should now be 401, not 200
curl -i -X POST https://<api>/api/banks/update/1 \
  -H 'Content-Type: application/json' \
  -d '{"idBanks":1,"idBankBranches":1,"accountNumber":"1","accountHolderName":"x"}'

# Should now be 401
curl -i -X DELETE https://<api>/api/blogs/delete/1
curl -i https://<api>/api/user-bank/1

# Should still be 200
curl -i https://<api>/api/projects/get_projects_for_investment

# Should be 200 but with no phoneNumber / email / nid* keys on any row
curl -s https://<api>/api/partners/get_all_partners \
  | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{
      const r=JSON.parse(s).data;
      const leaked=['email','phoneNumber','nidNumber','nidImageFront','nidImageBack','dateOfBirth','googleId','appleId'];
      console.log(leaked.filter(k=>r.some(x=>k in x)));  // expect []
    })"
```
