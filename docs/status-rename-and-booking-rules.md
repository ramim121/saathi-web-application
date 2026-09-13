# Booking rules and the `uploaded` → `proof_submitted` rename

Changes made after the client's decisions on 2026-08-10.

## 1. NID is now required to book

`bookings/create` had the NID check **commented out**. It is now enforced, on
the client's explicit instruction:

```ts
if (userVerification.nidVerified !== 'yes') { … 400 … }
```

`pending` returns `NID_PENDING` with "still being reviewed", separately from
`NID_UNVERIFIED`, so someone who has already submitted is not told to start
again.

**This affects the mobile app as well as the website** — it is the shared route.
Existing investors who never completed NID verification will be blocked at
checkout until an admin approves their submission. Worth a support note and a
look at how many accounts that is:

```sql
SELECT COUNT(*) FROM users
WHERE status <> 'deleted' AND (nid_verified IS NULL OR nid_verified <> 'yes');
```

## 2. Empty bookings can no longer be created

`projects` and `projectPartners` were `Joi.array().required()`, which **accepts
`[]`**. A request with an empty array produced a booking row with no projects,
no investors and a consumed booking number — a ghost record no screen can render
and no admin can act on. One was created accidentally during testing, which is
how this was found.

Both arrays now carry `.min(1)`.

## 3. `bookings/cancel` had no ownership check

The access check was commented out, so **any signed-in user could cancel anyone's
booking** by passing a sequential id, releasing their units. Now:

- non-admins may cancel only their own booking (404 otherwise — a 403 would
  confirm the id exists);
- non-admins may not cancel a **confirmed** booking, because that needs a refund
  decision;
- cancelling an already-cancelled booking is rejected rather than silently
  repeated.

## 4. Cancelled bookings no longer ask for payment

`cancelled` is a **separate column**, not a value of
`payment_confirmation_status`. A cancelled booking keeps whatever payment status
it had, so a cancelled-but-pending booking rendered as "Awaiting payment" with
the proof-of-payment form attached — inviting a second payment for units that
had already been released.

The website now reads `cancelled` independently. Verified end to end: a booking
with `cancelled=yes, payment_confirmation_status=pending` renders as
**Cancelled** with no payment form.

## 5. The status rename, staged

`uploaded` is being renamed to `proof_submitted`.

**The obstacle:** the shipped mobile app compares the raw string in two places —
`MyInvestment.tsx` and `PendingProofOfPaymentList.tsx`. A binary already on a
phone cannot be updated by a deploy, so flipping the writer today would make
those screens misread every newly submitted booking for anyone who has not
updated.

So it is staged, readers first:

| Step | State |
|---|---|
| 1. `proof_submitted` added to the ENUM (`005_proof_submitted_enum.sql`) | ✅ applied |
| 2. Every reader we control accepts **both** values | ✅ done — API, admin panel, website, and the app's *source* |
| 3. Ship a mobile app release built from that source | ⏳ yours |
| 4. Flip `PROOF_SUBMITTED_WRITE_VALUE` and run `006_rename_uploaded_status.sql` | ⏳ after step 3 |

`src/utils/bookingStatus.ts` holds the constant and `isProofSubmitted()`. Step 4
is one line and one migration, both reversible while the ENUM still accepts the
legacy value.

Doing step 4 before step 3 is the only way to break this.

## 6. Bank details

`digigram_banks` now holds the Mutual Trust account (`003`), with the columns
widened after `branch_name VARCHAR(25)` silently truncated the branch (`004`).

`SubmitProofOfPayment.tsx` no longer hardcodes the five values — it fetches
`/api/digigram_bank_info`, keeping the current values as initial state so a slow
or failed request still shows a correct account rather than five blank rows on a
payment screen. A future bank change becomes an UPDATE, not an app release.

## What could not be tested here

**A successful proof-of-payment upload.** The flow was exercised end to end and
fails at the S3 write:

```
PutObject s3://saathi-production-2025/proof-of-payment/…  →  AccessDenied
  with ACL public-read : AccessDenied
  without any ACL      : AccessDenied
```

Both fail, so it is the **credentials in `.env`**, not the `public-read` ACL.
Everything before that point is verified: auth, the ownership check, the
conditional field rules, formidable parsing. The handler rolls the transaction
back correctly on the failure.

Two things follow, and both are for you:

1. If the same `S3_BUCKET_ACCESS_KEY` is on the production server, **proof
   upload, NID upload and profile photos are broken in production right now.**
   The most recent stored proof in this database is dated 2026-03-10.
2. This is the key rotation already listed as B2 in `SECURITY-REMEDIATION.md`.

Once working credentials are in place, the remaining test is: place a booking,
upload a receipt, confirm `payment_confirmation_status` moves and the object
lands under `proof-of-payment/`.

## Test data

Every row created while testing was removed. The bookings table is back to
`MAX(id) = 320`, `MAX(booking_id) = '000129'`, 127 rows, with no orphaned
investor or partner-investor records.
