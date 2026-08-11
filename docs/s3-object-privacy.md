# S3 object privacy

What was public, what is now fixed, and what is deliberately still open.

## What was found

With working credentials in place, every upload path was checked. All five
uploaders were writing `ACL: 'public-read'`:

| Prefix | Contents | Anonymous request |
|---|---|---|
| `proof-of-payment/` | bank receipts, deposit slips, cheque images | **200 — readable** |
| `nid/` | national ID card scans, front and back | **200 — readable** |
| `profile/` | profile photographs | 200 — readable |

Verified, not inferred: an anonymous `GET` on a freshly uploaded receipt
returned 200, and an anonymous `HEAD` on a NID scan returned 200. There are
**97 NID scans** and **60 payment receipts** on file.

The filenames are SHA-256 hashes, so they are not enumerable. That is not a
mitigation worth relying on: an unguessable URL leaks through referrer headers,
browser history, screenshots, support tickets, and anywhere the link is pasted.

## Fixed: proof of payment

Complete, and it needed no app release — the mobile app **uploads** receipts but
never displays them, so the only consumer was the admin panel.

1. **Uploads no longer set a public ACL** (`proof-of-payment-upload/[id].ts` and
   `upload.ts`).
2. **New route `/api/files/proof-of-payment/{bookingId}`** checks that the caller
   owns the booking — or is an admin — then redirects to a presigned URL that
   expires in five minutes. It takes the **booking id, not the filename**, so
   holding a filename grants nothing; authorisation is decided against a record.
   It answers 404, never 403, so it cannot be used to discover which bookings
   exist. It accepts a bearer token *or* the `saathi-token` cookie, because an
   `<img src>` cannot send a header.
3. **The admin panel points at that route** instead of the bucket URL.
4. **`db/make-proofs-private.mjs` retrofitted the existing objects.**

Verified afterwards:

```
anonymous HEAD on 5 sampled receipts   403 forbidden  (was 200)
/api/files/proof-of-payment/{id}
  no token                             401
  a different signed-in user           404
  the owner                            302 → presigned S3 URL
  admin via cookie, as the <img> does  200, image loads
```

⚠️ **The retrofit was subsequently reverted.** Staging and production share this
bucket, and the 57 objects turned out to be referenced by the production
database too — making them private broke the production admin panel, which still
reads the public URL. Run `node db/make-proofs-private.mjs` again once the fixed
admin panel is deployed. See `staging-vs-production.md`.

## NID scans — read path built, writer not yet flipped

Steps 1 and 2 are **done**. They change nothing for the shipped app, so they
were safe to land now.

**Done:**

1. **`GET /api/files/nid/{idUsers}?side=front|back`** — checks that the caller
   owns the record or is an admin, then redirects to a five-minute presigned
   URL. It takes the **user id, not a filename**, so a leaked filename grants
   nothing. 404 rather than 403 throughout, so it cannot be used to discover
   which accounts have submitted a NID.
2. **The admin panel (`users.tsx`) reads through that route** instead of the
   public bucket URL.

Verified:

```
no token                        401
a different signed-in user      404
the owner                       302 → presigned URL
admin via cookie                302
back side                       302
a user id that does not exist   404
```

**Still to do, and why it waits:**

3. Point the mobile app's two NID screens at the same route, and ship a release.
4. Remove `ACL: 'public-read'` from `profile/nid.ts` (two occurrences).
5. Retrofit the existing objects, in **both** buckets.

Steps 4 and 5 must not land before step 3 is adopted. The shipped app renders
NID images straight from the bucket URL:

```
saathi-mobile-app/src/screens/Profile/NidInfo.tsx:57,77
saathi-mobile-app/src/screens/Profile/ProfileInfo.tsx:966,990
    <Image source={{ uri: `${PUBLIC_RESOURCES_URL}nid/${imageFront}` }} />
```

Making the prefix private today would leave every installed copy showing a
broken image where the user reviews their own ID. Uploading and verification
would keep working — the breakage is display only — but it is still a live
regression, and it is a product call rather than a technical one.

### Both buckets, not one

`saathi-files-new` mirrors the same objects and serves them publicly too:

```
nid/<file>                saathi-production-2025 → 200   saathi-files-new → 200
proof-of-payment/<file>   saathi-production-2025 → 200   saathi-files-new → 200
```

Locking one does nothing about the copy in the other, so step 5 must cover both.
How the mirroring happens was never established — if it is a replication rule,
it will re-create public copies after a retrofit.

### Staging deliberately holds no NID scans

`nid/` and `proof-of-payment/` were excluded when `saathi-staging-2026` was
seeded, so those screens show nothing in staging. That is the intended trade:
duplicating real ID cards into another bucket for a test environment doubles the
places they can leak from. Upload your own through the app to exercise the
screens — those writes go to the staging bucket.

## Bucket-level note

`ACL: 'public-read'` **succeeded**, which means the bucket does not have S3
Block Public Access fully enabled. Once no uploader sets a public ACL, turning
that on at the bucket level would make this class of mistake impossible rather
than merely absent — worth doing as the last step, after the NID work.
