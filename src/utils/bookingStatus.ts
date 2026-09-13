/**
 * Payment confirmation status — one definition, shared.
 *
 * THE RENAME, AND WHY IT IS STAGED
 * The value written when an investor submits a receipt was `uploaded`. It is
 * being renamed to `proof_submitted`, which says what happened rather than what
 * the file did.
 *
 * The complication is that the **shipped mobile app** compares the raw string:
 *
 *   MyInvestment.tsx:94              paymentConfirmationStatus === 'uploaded'
 *   PendingProofOfPaymentList.tsx:220 paymentConfirmationStatus == 'uploaded'
 *
 * A binary already on someone's phone cannot be updated by a deploy. Flipping
 * the writer today would make those two screens misread every newly submitted
 * booking, for every user who has not updated — which is precisely the class of
 * breakage this project is meant to avoid.
 *
 * So the change is staged, readers first:
 *
 *   1. (done) `proof_submitted` added to the ENUM, so the column can hold it.
 *   2. (done) Every reader we control — this API, the admin panel, the website,
 *      and the mobile app's *source* — accepts **either** value via
 *      `isProofSubmitted()`.
 *   3. (pending) Ship the mobile app release built from that source.
 *   4. (pending) Flip `PROOF_SUBMITTED_WRITE_VALUE` below to `proof_submitted`
 *      and run `db/migrations/006_rename_uploaded_status.sql` to convert the
 *      existing rows. One line and one migration, both reversible.
 *
 * Doing step 4 before step 3 is the only way to break this. The comment on the
 * constant says so too.
 */

export const PROOF_SUBMITTED = 'proof_submitted' as const;
export const PROOF_UPLOADED_LEGACY = 'uploaded' as const;

export type PaymentConfirmationStatus =
    | 'pending'
    | typeof PROOF_UPLOADED_LEGACY
    | typeof PROOF_SUBMITTED
    | 'confirmed'
    | 'denied';

/**
 * What the API writes when a receipt is submitted.
 *
 * ⚠️ Do not change this to `PROOF_SUBMITTED` until an app release that uses
 * `isProofSubmitted()` is live. See the staging note above.
 */
export const PROOF_SUBMITTED_WRITE_VALUE: PaymentConfirmationStatus = PROOF_UPLOADED_LEGACY;

/** True for both the legacy and the new value. Use this instead of comparing strings. */
export function isProofSubmitted(status: string | null | undefined): boolean {
    return status === PROOF_SUBMITTED || status === PROOF_UPLOADED_LEGACY;
}
