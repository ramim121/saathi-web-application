/**
 * Column allowlists for endpoints an anonymous caller can reach.
 *
 * WHY THIS EXISTS
 * Several public routes called `User.findAll()` with no `attributes`, so
 * Sequelize returned every column on the `users` row — including `email`,
 * `phoneNumber`, `nidNumber` and the `nidImageFront` / `nidImageBack` S3 keys.
 * A live probe of /api/partners/get_all_partners returned 36 partner rows with
 * `phoneNumber` populated on every one. The NID columns were null on the test
 * database, but they are in the projection, so they serialise as soon as a
 * production row has them.
 *
 * `password` was never exposed — the User model carries
 * `defaultScope: { attributes: { exclude: ['password'] } }`.
 *
 * RULE: only add a column here if it is safe for an unauthenticated caller,
 * a scraper and a search engine to read. Contact details, identity documents,
 * verification state and federated-login ids do not belong in this list.
 */

/**
 * Partner profile fields shown on public listings and profile screens.
 *
 * `disability` is deliberately included: the mobile app renders it as a badge
 * (PartnersScreen, PartnerList), shows it on the partner profile, and filters
 * on it via `?disability=yes`. Removing it would break shipped app screens.
 * It is inclusion data the partners are presented under, not a hidden attribute
 * — but if that changes, this is the one line to revisit.
 *
 * `phoneNumber` is deliberately excluded: no mobile-app screen reads a
 * partner's phone number, and the admin listing (`/api/partners/list`) is
 * token-gated and keeps its own projection.
 */
export const PUBLIC_PARTNER_ATTRIBUTES = [
    'idUsers',
    'fullName',
    'profileImage',
    'age',
    'location',
    'role',
    'bio',
    'interestedIn',
    'skills',
    'joiningDate',
    'education',
    'disability',
    'partnerType',
    // Bangla counterparts (migration 002). Safe by the same reasoning as the
    // English columns they mirror — they are the same public copy in Bangla.
    'fullNameBn',
    'roleBn',
    'bioBn',
    'skillsBn',
    'locationBn',
    'interestedInBn',
    'educationBn',
] as const;

/**
 * The same set, typed for Sequelize's `attributes` option, which wants a
 * mutable `string[]` rather than a readonly tuple.
 */
export const publicPartnerAttributes = (): string[] => [...PUBLIC_PARTNER_ATTRIBUTES];
