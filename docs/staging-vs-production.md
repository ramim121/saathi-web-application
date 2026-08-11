# Staging and production are not as separate as they look

Comparison of `saathi-web-application/.env` (staging) against
`saathi-web-application-production-config/` (production). No secret values are
reproduced here — only whether they match.

## What differs, and what does not

| | Production | Staging | |
|---|---|---|---|
| Database **name** | `shathi_db_prod_2` | `saathi_db` | ✅ separate |
| Database **host** | `saathi-db-new…rds.amazonaws.com` | same | ⚠️ one RDS instance |
| Database **password** | — | — | ⚠️ **identical** |
| `JWT_SECRET` | — | — | ✅ different |
| **S3 bucket** | `saathi-production-2025` | same | 🔴 **shared** |
| **S3 credentials** | — | — | 🔴 **identical** |
| SES key | — | — | ✅ different |
| Google client id | — | — | same (a client id is not a secret) |

So the separation is real for the database *contents* and for sessions, and
absent for file storage.

## Why this matters, concretely

It is not theoretical. While making payment receipts private — a change intended
for staging — the objects that changed were **production's**:

```
staging  bookings with a proof file   60
production bookings with a proof file 84
filenames present in BOTH databases   57
```

Staging was evidently seeded from a production dump, so the rows carry the same
filenames, and the files themselves live in the one shared bucket. Setting 57
objects to `private` therefore hid them from the **production** admin panel,
which still reads the public bucket URL.

They were reverted to `public-read` as soon as this was found, and production
was confirmed working again (8 of 8 sampled thumbnails readable). The retrofit
script now takes `--revert` for exactly this reason.

**Anything done against the staging `.env` reaches production files.** Uploads,
deletions and ACL changes all land in the same bucket, with credentials that
have the same permissions.

## A second bucket, also public

`saathi-files-new` mirrors the same objects and serves them publicly too:

```
nid/<file>                saathi-production-2025 → 200   saathi-files-new → 200
proof-of-payment/<file>   saathi-production-2025 → 200   saathi-files-new → 200
```

The mobile app reads from `saathi-files-new`; the API writes to
`saathi-production-2025`. Making an object private in one bucket does nothing
about the copy in the other — so the privacy work described in
`s3-object-privacy.md` is only half a fix until both are covered.

How the mirroring happens (replication rule, or a second uploader) was not
established. That needs answering before either bucket is locked down, because
a one-way replication rule will happily re-create public copies.

## What to do

1. **Give staging its own bucket.** `shathi-staging-2026` or similar, with its
   own IAM user restricted to it. Until then, treat every staging file operation
   as a production one.
2. **Give staging its own database credentials.** Same host is tolerable; the
   same password means a staging leak is a production leak.
3. **Work out what mirrors into `saathi-files-new`**, then apply the privacy
   work to both buckets together.
4. **Rotate the shared S3 keys** once staging has its own — these are the keys
   that were committed to git, and they are still the production keys.

Until step 1 is done, the safe rule for anyone working on staging: **read freely,
write nothing** in S3.

## Note on the production constants file

`api_saathi-web-application-production_constants.ts` still contains hardcoded
secret fallbacks — JWT secret, database password, S3 and SES keys — in the same
pattern that was removed from the staging codebase. The deployed copy should be
replaced with the current `src/config/constants.ts`, which reads everything from
the environment and refuses to start if something is missing.

That file also defines `API_URL` twice, the second one `http://localhost:3000/`,
which silently wins.
