/**
 * The one place that decides whether an account may invest, and what to say
 * when it may not.
 *
 * WHY THIS IS SHARED
 * The check lived twice — `api/bookings/create` (mobile app) and
 * `api/v2/web/bookings/create` (website) — with the same logic retyped and the
 * wording already drifting ("Please verify your NID before making any
 * investment" against "Verify your NID before investing."). Two copies of a
 * rule that gates money is one copy too many: the next state added to the enum
 * would have had to be remembered in both, and the enum has already grown once.
 *
 * WHY `rejected` NEEDED ITS OWN BRANCH
 * `nid_verification_status` has four values and the old check only separated
 * two of them: `pending`, and everything-else. So an investor whose NID an
 * admin had *rejected* was told "Please verify your NID before making any
 * investment" — the same sentence shown to someone who had never uploaded
 * anything at all. They had uploaded it. It was looked at and turned down.
 * Telling them to do the thing they already did gives them no reason to try
 * again and nothing to do differently, and the only notice they ever got was a
 * `nid_verification_failed` message at the moment of rejection, which is long
 * gone by the time they next open the cart. Three production accounts are
 * sitting in exactly this state.
 *
 * WHY THE MESSAGE MATTERS MORE THAN THE CODE
 * The shipped mobile app renders `message` verbatim in its "Failed to book!"
 * modal — it does not read `code`. So the sentence here is the entire user
 * experience of being refused, and changing it takes effect on phones that are
 * already installed, with no app release. `code` is for the website, which can
 * branch on it to render an action (a re-upload link) rather than a sentence.
 */

/** Shape this gate needs. Anything with these two fields will do. */
export type NidGateUser = {
    nidVerified: 'yes' | 'no';
    nidVerificationStatus: 'none' | 'pending' | 'approved' | 'rejected';
};

export type NidGateRefusal = {
    code: 'NID_PENDING' | 'NID_REJECTED' | 'NID_UNVERIFIED';
    message: string;
};

/**
 * `null` means the account may invest.
 *
 * Note the source of truth is `nidVerified`, not `nidVerificationStatus`:
 * approval sets both, and only `nidVerified` is what `verify.ts` flips. A row
 * that somehow reads `approved` while `nidVerified` is still `no` has not been
 * approved and must not be let through — so the status is used only to explain
 * a refusal, never to grant one.
 */
export function checkNidEligibility(user: NidGateUser): NidGateRefusal | null {
    if (user.nidVerified === 'yes') return null;

    switch (user.nidVerificationStatus) {
        case 'pending':
            return {
                code: 'NID_PENDING',
                message:
                    'Your NID is still being reviewed. You can invest as soon as it is approved.',
            };

        case 'rejected':
            return {
                code: 'NID_REJECTED',
                // Says what happened, and what to do about it. "Verify your
                // NID" said neither.
                message:
                    'Your NID could not be verified. Please upload clear photographs of both sides again from Menu → Profile, or contact support at info@digigramventures.com.',
            };

        // 'none', 'approved'-without-nidVerified, or anything added later.
        default:
            return {
                code: 'NID_UNVERIFIED',
                message:
                    'Please verify your NID before making any investment. You can upload it from Menu → Profile.',
            };
    }
}
