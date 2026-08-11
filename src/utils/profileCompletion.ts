import type { UserModel } from '@/models/User';

/**
 * What a freshly-created account still has to answer before it is usable.
 *
 * TWO DIFFERENT BARS, DELIBERATELY
 *
 *   `needsProfile` — name and gender. Asked immediately after signup, because
 *   an account with no name shows up as a blank row everywhere: 121 of 425
 *   existing accounts have none, and every email to them used to open "Dear ,".
 *   Everything else (address, date of birth, bank) is deferred to the profile
 *   screen and can be skipped indefinitely.
 *
 *   `bookingBlockers` — a verified contact channel and a verified NID. This is
 *   the financial bar and it is unchanged by web signup: someone can register
 *   on the website, browse, and complete their profile, but cannot place a
 *   booking until an admin has verified their NID.
 *
 * Keeping both in one file is the point. The website, the app and the booking
 * endpoint have to agree on what "ready" means, and they only will if there is
 * one definition.
 */

export type ProfileGap = 'name' | 'gender';
export type BookingBlocker = 'contact' | 'nid' | 'nid_pending';

/** Name and gender — the two things asked straight after signup. */
export function profileGaps(user: Pick<UserModel, 'fullName' | 'gender'>): ProfileGap[] {
    const gaps: ProfileGap[] = [];
    if (!user.fullName || String(user.fullName).trim() === '') gaps.push('name');
    if (!user.gender) gaps.push('gender');
    return gaps;
}

export function needsProfile(user: Pick<UserModel, 'fullName' | 'gender'>): boolean {
    return profileGaps(user).length > 0;
}

/**
 * Why this account cannot place a booking yet, in the order worth fixing.
 *
 * `nid_pending` is separated from `nid` on purpose: someone who has submitted
 * their NID and is waiting on review must not be shown a form they already
 * completed, because that reads as though their submission was lost.
 */
export function bookingBlockers(
    user: Pick<UserModel, 'emailVerified' | 'phoneVerified' | 'nidVerified' | 'nidVerificationStatus'>,
): BookingBlocker[] {
    const blockers: BookingBlocker[] = [];

    // Either channel is enough. Signing in by SMS proves the phone; signing in
    // with Google proves the address.
    if (user.emailVerified !== 'yes' && user.phoneVerified !== 'yes') {
        blockers.push('contact');
    }

    if (user.nidVerified !== 'yes') {
        blockers.push(user.nidVerificationStatus === 'pending' ? 'nid_pending' : 'nid');
    }

    return blockers;
}

export function canBook(
    user: Pick<UserModel, 'emailVerified' | 'phoneVerified' | 'nidVerified' | 'nidVerificationStatus'>,
): boolean {
    return bookingBlockers(user).length === 0;
}
