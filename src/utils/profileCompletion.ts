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
 *   `bookingBlockers` — a verified contact channel. This is the only bar in
 *   front of a booking. An approved NID used to be part of it and no longer is
 *   (removed 2026-11-13): NID is still collected and reviewed, but it does not
 *   stop anyone investing.
 *
 * Keeping both in one file is the point. The website, the app and the booking
 * endpoint have to agree on what "ready" means, and they only will if there is
 * one definition.
 */

export type ProfileGap = 'name' | 'gender';
export type BookingBlocker = 'contact';

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
 * Why this account cannot place a booking yet.
 *
 * NID is deliberately absent. It mirrors `api/bookings/create`, which no longer
 * looks at NID status at all.
 */
export function bookingBlockers(
    user: Pick<UserModel, 'emailVerified' | 'phoneVerified'>,
): BookingBlocker[] {
    const blockers: BookingBlocker[] = [];

    // Either channel is enough. Signing in by SMS proves the phone; signing in
    // with Google proves the address.
    if (user.emailVerified !== 'yes' && user.phoneVerified !== 'yes') {
        blockers.push('contact');
    }

    return blockers;
}

export function canBook(
    user: Pick<UserModel, 'emailVerified' | 'phoneVerified'>,
): boolean {
    return bookingBlockers(user).length === 0;
}
