/**
 * API map — every backend route, who calls it, and why.
 *
 * Transcribed from the three codebases rather than from memory:
 *   backend   `src/pages/api/**` (130 route files)
 *   app       `saathi-mobile-app/src/**` calls through `utility/fetch.tsx`
 *   website   `digigram-website-redesign/src/**` calls through `lib/api/client.ts`
 *
 * WHY THIS FILE EXISTS
 * The website was built against the same API as the app. That is deliberate —
 * one backend, one source of truth — but it means a change to a shared route
 * affects a shipped mobile binary that cannot be patched. This map is what you
 * check before touching one.
 *
 * `consumers` is what actually calls the route today, verified by grep, not by
 * intention.
 */

export type Consumer = 'app' | 'web' | 'admin';

export type ApiKind =
    /** Existed before this project. Called by the app, and reused unchanged. */
    | 'shared'
    /** Existed before. Only the admin panel uses it. */
    | 'admin-only'
    /** Added during this project, for the website. */
    | 'new-v2'
    /** Superseded by a v2 route; kept alive only for the shipped app. */
    | 'legacy';

export type ApiEntry = {
    path: string;
    methods: string[];
    /** 'public' | 'user' | 'admin' */
    auth: 'public' | 'user' | 'admin';
    feature: string;
    consumers: Consumer[];
    kind: ApiKind;
    /** Website route handler that proxies this, if any. */
    webProxy?: string;
    notes?: string;
};

export const API_MAP: ApiEntry[] = [
    /* ------------------------------------------------------------- auth -- */
    {
        path: '/api/otp',
        methods: ['POST', 'PUT'],
        auth: 'public',
        feature: 'Authentication',
        consumers: ['app'],
        kind: 'shared',
        notes:
            'POST sends a code, PUT verifies. **Creates the account when the phone is unknown** — this is how the app registers people. The website must never call it, because that would make its login form a silent signup form.',
    },
    {
        path: '/api/v2/web/otp',
        methods: ['POST', 'PUT'],
        auth: 'public',
        feature: 'Authentication',
        consumers: ['web'],
        kind: 'new-v2',
        webProxy: '/api/auth/otp/request, /api/auth/otp/verify',
        notes:
            'Same verification, but signs in an existing account only. Unknown number → 404 NOT_REGISTERED, which the site turns into the "register in the app" panel. Also refuses to re-bind a phone number to a session, which /api/otp allows.',
    },
    {
        path: '/api/auth/google',
        methods: ['POST'],
        auth: 'public',
        feature: 'Authentication',
        consumers: ['app'],
        kind: 'shared',
        notes: 'Verifies the Google ID token and **creates** the account if the email is unknown.',
    },
    {
        path: '/api/v2/web/google',
        methods: ['POST'],
        auth: 'public',
        feature: 'Authentication',
        consumers: ['web'],
        kind: 'new-v2',
        webProxy: '/api/auth/google',
        notes:
            'Sign-in only, never creates. Additionally requires Google’s own `email_verified`, so an unverified address cannot claim an account.',
    },
    {
        path: '/api/auth/apple',
        methods: ['POST'],
        auth: 'public',
        feature: 'Authentication',
        consumers: ['app'],
        kind: 'shared',
        notes: 'Apple sign-in. No website equivalent yet.',
    },
    {
        path: '/api/login',
        methods: ['POST'],
        auth: 'public',
        feature: 'Authentication',
        consumers: ['admin'],
        kind: 'admin-only',
        notes: 'Email + password. Admin panel only; app and website use OTP/Google.',
    },

    /* ---------------------------------------------------------- profile -- */
    {
        path: '/api/user',
        methods: ['GET', 'PUT'],
        auth: 'user',
        feature: 'Profile',
        consumers: ['app', 'web'],
        kind: 'shared',
        webProxy: '/api/account/profile',
        notes:
            'PUT updates name, date of birth and email. It does **not** set `emailVerified` — only Google sign-in does. Any UI implying otherwise is wrong.',
    },
    {
        path: '/api/profile/nid',
        methods: ['POST'],
        auth: 'user',
        feature: 'Profile',
        consumers: ['app', 'web'],
        kind: 'shared',
        webProxy: '/api/account/nid',
        notes:
            'Multipart, fields `nidfront` / `nidback`. Sets `nidVerificationStatus = pending`; an admin approves. Required before booking.',
    },
    {
        path: '/api/profile/picture',
        methods: ['POST'],
        auth: 'user',
        feature: 'Profile',
        consumers: ['app', 'web'],
        kind: 'shared',
        webProxy: '/api/account/photo',
        notes:
            'Multipart, field `profile-picture`. **Returns `success: false` on the happy path** — judge it by HTTP status.',
    },
    {
        path: '/api/verify',
        methods: ['POST'],
        auth: 'admin',
        feature: 'Profile',
        consumers: ['admin'],
        kind: 'admin-only',
        notes: 'Admin approves NID / email / phone verification.',
    },
    {
        path: '/api/user/address',
        methods: ['GET', 'POST', 'PUT'],
        auth: 'user',
        feature: 'Profile',
        consumers: ['app'],
        kind: 'shared',
        notes: 'Delivery addresses for the product shop. Not used by the website.',
    },
    {
        path: '/api/delete-user',
        methods: ['POST'],
        auth: 'user',
        feature: 'Profile',
        consumers: ['app', 'web'],
        kind: 'shared',
        notes: 'Account deletion request, required by both app stores.',
    },

    /* ----------------------------------------------------------- banks -- */
    {
        path: '/api/banks/get_all_banks',
        methods: ['GET'],
        auth: 'public',
        feature: 'Bank accounts',
        consumers: ['app', 'web'],
        kind: 'shared',
        webProxy: '/api/account/banks',
    },
    {
        path: '/api/banks/[id]',
        methods: ['GET'],
        auth: 'public',
        feature: 'Bank accounts',
        consumers: ['app', 'web'],
        kind: 'shared',
        webProxy: '/api/account/banks?bank={id}',
        notes: 'Branches for one bank.',
    },
    {
        path: '/api/banks/user-bank',
        methods: ['GET', 'POST', 'PUT'],
        auth: 'user',
        feature: 'Bank accounts',
        consumers: ['app', 'web'],
        kind: 'shared',
        webProxy: '/api/account/bank',
        notes: '`default` is the string "yes"/"no", not a boolean.',
    },
    {
        path: '/api/user-bank/[id]',
        methods: ['GET'],
        auth: 'user',
        feature: 'Bank accounts',
        consumers: ['web'],
        kind: 'shared',
        notes: 'Ownership-checked in Phase A; it had no auth at all before.',
    },
    {
        path: '/api/banks/update/[id]',
        methods: ['POST'],
        auth: 'user',
        feature: 'Bank accounts',
        consumers: ['app'],
        kind: 'shared',
        notes: 'Had no auth and no ownership check — anyone could rewrite any payout account. Fixed in Phase A.',
    },
    {
        path: '/api/digigram_bank_info',
        methods: ['GET'],
        auth: 'public',
        feature: 'Bank accounts',
        consumers: ['app', 'web'],
        kind: 'shared',
        notes:
            'DigiGram’s receiving account. The app used to hardcode these values and drifted from the table; it now reads this.',
    },

    /* -------------------------------------------------------- projects -- */
    {
        path: '/api/projects/get_projects_for_investment',
        methods: ['GET'],
        auth: 'public',
        feature: 'Projects',
        consumers: ['web'],
        kind: 'shared',
        notes: 'The investable list. Decimals arrive as strings.',
    },
    {
        path: '/api/projects/get_all_projects',
        methods: ['GET'],
        auth: 'public',
        feature: 'Projects',
        consumers: ['app'],
        kind: 'shared',
    },
    {
        path: '/api/projects/details/[id]',
        methods: ['GET'],
        auth: 'public',
        feature: 'Projects',
        consumers: ['app', 'web'],
        kind: 'shared',
        notes: 'Only this payload carries partners and the image gallery. `description` is dead — read `summary`.',
    },
    {
        path: '/api/projects/project-partners/[id]',
        methods: ['GET'],
        auth: 'public',
        feature: 'Projects',
        consumers: ['web'],
        kind: 'shared',
        notes: 'Partners assigned to a project. A booking must name at least one.',
    },
    {
        path: '/api/project-categories/get_all_categories',
        methods: ['GET'],
        auth: 'public',
        feature: 'Projects',
        consumers: ['app'],
        kind: 'shared',
        notes: 'Real category ids are 9 (agriculture/livestock), 10 (artisanal), 11 (environmental).',
    },
    {
        path: '/api/popular_projects',
        methods: ['GET'],
        auth: 'public',
        feature: 'Projects',
        consumers: ['app'],
        kind: 'shared',
    },

    /* -------------------------------------------------------- bookings -- */
    {
        path: '/api/bookings/create',
        methods: ['POST'],
        auth: 'user',
        feature: 'Bookings',
        consumers: ['app', 'web'],
        kind: 'shared',
        webProxy: '/api/bookings/create',
        notes:
            'Now requires a verified contact **and** a verified NID (the NID check was previously commented out). `projects` and `projectPartners` now require at least one entry — an empty array used to create a ghost booking.',
    },
    {
        path: '/api/v2/web/bookings/create',
        methods: ['POST'],
        auth: 'user',
        feature: 'Bookings',
        consumers: ['web'],
        kind: 'new-v2',
        notes:
            'Added when the shared route did not enforce NID. **Now largely redundant** — the shared route enforces both checks itself. It still returns a machine-readable `CONTACT_UNVERIFIED` code. Candidate for retirement: point the website proxy at `/api/bookings/create` and delete this.',
    },
    {
        path: '/api/bookings/details/[id]',
        methods: ['GET'],
        auth: 'public',
        feature: 'Bookings',
        consumers: ['app'],
        kind: 'legacy',
        notes:
            '⚠️ Unauthenticated, and the id comes from the URL — any booking is readable by guessing a sequential integer. Cannot be locked while the app calls it (a 401 force-logs-out the user). Retire once the app ships a build using the v2 route.',
    },
    {
        path: '/api/v2/web/bookings/[id]',
        methods: ['GET'],
        auth: 'user',
        feature: 'Bookings',
        consumers: ['web'],
        kind: 'new-v2',
        notes: 'Ownership-checked, then delegates to the route above. Answers 404 — not 403 — for someone else’s booking.',
    },
    {
        path: '/api/bookings/proof-of-payment-upload/[id]',
        methods: ['POST'],
        auth: 'user',
        feature: 'Bookings',
        consumers: ['app', 'web'],
        kind: 'shared',
        webProxy: '/api/bookings/proof',
        notes:
            'Multipart, field `proofOfPayment`, JPEG/PNG only. Ownership check added in Phase A. `collectionDate` must be `YYYY-MM-DD HH:mm:ss`, and `idUserBanks` must be a string.',
    },
    {
        path: '/api/bookings/cancel',
        methods: ['PUT'],
        auth: 'user',
        feature: 'Bookings',
        consumers: ['app', 'web'],
        kind: 'shared',
        webProxy: '/api/bookings/cancel',
        notes:
            'Its access check was commented out — any signed-in user could cancel anyone’s booking. Now ownership-checked, refuses confirmed bookings for non-admins, and refuses a double cancel.',
    },
    {
        path: '/api/investors/invested-projects/[id]',
        methods: ['GET'],
        auth: 'user',
        feature: 'Bookings',
        consumers: ['app'],
        kind: 'legacy',
        notes: 'Takes the user id from the URL. Superseded by `/api/v2/investments/mine`.',
    },
    {
        path: '/api/v2/investments/mine',
        methods: ['GET'],
        auth: 'user',
        feature: 'Bookings',
        consumers: ['web'],
        kind: 'new-v2',
        notes: 'Same payload, user taken from the token instead of the URL. Filters out cancelled bookings.',
    },
    {
        path: '/api/bookings/confirm',
        methods: ['POST'],
        auth: 'admin',
        feature: 'Bookings',
        consumers: ['admin'],
        kind: 'admin-only',
    },
    {
        path: '/api/bookings/deny',
        methods: ['POST'],
        auth: 'admin',
        feature: 'Bookings',
        consumers: ['admin'],
        kind: 'admin-only',
    },
    {
        path: '/api/bookings/list',
        methods: ['GET'],
        auth: 'admin',
        feature: 'Bookings',
        consumers: ['admin'],
        kind: 'admin-only',
    },

    /* --------------------------------------------------------- content -- */
    {
        path: '/api/partnerships/all-partnerships',
        methods: ['GET'],
        auth: 'public',
        feature: 'Content',
        consumers: ['app', 'web'],
        kind: 'shared',
        notes: 'Partner logos, prefix `partnerships/` on S3.',
    },
    {
        path: '/api/investor-testimonials/all-testimonials',
        methods: ['GET'],
        auth: 'public',
        feature: 'Content',
        consumers: ['app', 'web'],
        kind: 'shared',
        notes: '`rating` is a decimal-as-string.',
    },
    {
        path: '/api/blogs/list',
        methods: ['GET'],
        auth: 'public',
        feature: 'Content',
        consumers: ['app', 'web'],
        kind: 'shared',
        notes: 'Carries the full body, so the website’s detail page reads from here rather than an admin route.',
    },
    {
        path: '/api/top_blogs',
        methods: ['GET'],
        auth: 'public',
        feature: 'Content',
        consumers: ['app'],
        kind: 'shared',
    },
    {
        path: '/api/stat-panels/all-stat-panel',
        methods: ['GET'],
        auth: 'public',
        feature: 'Content',
        consumers: ['app'],
        kind: 'shared',
    },

    /* -------------------------------------------------------- partners -- */
    {
        path: '/api/partners/get_all_partners',
        methods: ['GET'],
        auth: 'public',
        feature: 'Partners',
        consumers: ['app'],
        kind: 'shared',
        notes:
            'Returned every column of the users row to anonymous callers, including phone numbers and NID fields. Now an explicit allowlist. `disability` is kept because the app renders and filters on it.',
    },
    {
        path: '/api/top_partners',
        methods: ['GET'],
        auth: 'public',
        feature: 'Partners',
        consumers: ['app'],
        kind: 'shared',
    },
    {
        path: '/api/partners/details/[id]',
        methods: ['GET'],
        auth: 'public',
        feature: 'Partners',
        consumers: ['app'],
        kind: 'shared',
    },
    {
        path: '/api/partners/list',
        methods: ['GET'],
        auth: 'admin',
        feature: 'Partners',
        consumers: ['admin'],
        kind: 'admin-only',
        notes: 'The one place a partner’s phone number is still exposed — admin-gated and confirmed in use.',
    },

    /* --------------------------------------------------------- support -- */
    {
        path: '/api/location/divisions',
        methods: ['GET'],
        auth: 'public',
        feature: 'Reference data',
        consumers: ['app'],
        kind: 'shared',
    },
    {
        path: '/api/location/districts',
        methods: ['GET'],
        auth: 'public',
        feature: 'Reference data',
        consumers: ['app'],
        kind: 'shared',
    },
    {
        path: '/api/location/police-stations',
        methods: ['GET'],
        auth: 'public',
        feature: 'Reference data',
        consumers: ['app'],
        kind: 'shared',
    },
    {
        path: '/api/all_skills',
        methods: ['GET'],
        auth: 'public',
        feature: 'Reference data',
        consumers: ['app', 'admin'],
        kind: 'shared',
    },
    {
        path: '/api/my-notifications',
        methods: ['GET'],
        auth: 'user',
        feature: 'Notifications',
        consumers: ['app'],
        kind: 'shared',
    },
    {
        path: '/api/fcm',
        methods: ['POST'],
        auth: 'user',
        feature: 'Notifications',
        consumers: ['app'],
        kind: 'shared',
        notes: 'Push token registration. No website equivalent.',
    },
    {
        path: '/api/contact',
        methods: ['POST'],
        auth: 'public',
        feature: 'Support',
        consumers: ['web'],
        kind: 'shared',
    },
    {
        path: '/api/version',
        methods: ['GET'],
        auth: 'public',
        feature: 'Support',
        consumers: ['app'],
        kind: 'shared',
        notes: 'Force-update check.',
    },

    /* ------------------------------------------------------------ shop -- */
    {
        path: '/api/products',
        methods: ['GET'],
        auth: 'public',
        feature: 'Shop',
        consumers: ['app'],
        kind: 'shared',
        notes: 'Shathi Sheba product catalogue. The website does not sell products yet.',
    },
    {
        path: '/api/product-categories',
        methods: ['GET'],
        auth: 'public',
        feature: 'Shop',
        consumers: ['app'],
        kind: 'shared',
    },
    {
        path: '/api/partner-product/[...params]',
        methods: ['GET'],
        auth: 'public',
        feature: 'Shop',
        consumers: ['app'],
        kind: 'shared',
    },
    {
        path: '/api/user/order',
        methods: ['GET', 'POST'],
        auth: 'user',
        feature: 'Shop',
        consumers: ['app'],
        kind: 'shared',
    },
    {
        path: '/api/live-update/list/[id]',
        methods: ['GET'],
        auth: 'user',
        feature: 'Project updates',
        consumers: ['app'],
        kind: 'shared',
        notes: 'Progress updates on an investment. A good candidate for the website’s account area.',
    },
];

/* --------------------------------------------------- feature comparison -- */

export type FeatureRow = {
    feature: string;
    capability: string;
    /** When both platforms use the same route, `shared` is set and web/app are omitted. */
    shared?: string;
    web?: string;
    app?: string;
    note?: string;
};

/**
 * Feature-by-feature, web against app.
 *
 * Where both call the same endpoint, `shared` is filled and the viewer merges
 * the two cells — the point of the table is to make the *differences* visible,
 * and repeating an identical path twice buries them.
 */
export const FEATURE_MATRIX: FeatureRow[] = [
    {
        feature: 'Authentication',
        capability: 'Register a new account',
        app: '/api/otp (creates on first use), /api/auth/google',
        web: '— not possible by design',
        note: 'No signup on the web. The login form shows an app-download panel instead.',
    },
    {
        feature: 'Authentication',
        capability: 'Sign in with phone + OTP',
        app: '/api/otp',
        web: '/api/v2/web/otp',
        note: 'Different routes: the app’s creates an account, the website’s refuses to.',
    },
    {
        feature: 'Authentication',
        capability: 'Sign in with Google',
        app: '/api/auth/google',
        web: '/api/v2/web/google',
        note: 'Same split. The web route also requires Google’s `email_verified`.',
    },
    {
        feature: 'Authentication',
        capability: 'Sign in with Apple',
        app: '/api/auth/apple',
        web: '— not built',
    },
    {
        feature: 'Authentication',
        capability: 'Where the token is stored',
        app: 'AsyncStorage, sent as a bearer header',
        web: 'httpOnly cookie, never visible to client JavaScript',
    },
    {
        feature: 'Profile',
        capability: 'Read / update profile',
        shared: '/api/user',
    },
    {
        feature: 'Profile',
        capability: 'Submit NID',
        shared: '/api/profile/nid',
    },
    {
        feature: 'Profile',
        capability: 'Profile photo',
        shared: '/api/profile/picture',
    },
    {
        feature: 'Profile',
        capability: 'Delivery addresses',
        app: '/api/user/address',
        web: '— not built (shop only)',
    },
    {
        feature: 'Bank accounts',
        capability: 'Bank and branch lists',
        shared: '/api/banks/get_all_banks, /api/banks/[id]',
    },
    {
        feature: 'Bank accounts',
        capability: 'Add / list payout accounts',
        shared: '/api/banks/user-bank',
    },
    {
        feature: 'Bank accounts',
        capability: 'DigiGram’s receiving account',
        shared: '/api/digigram_bank_info',
        note: 'The app hardcoded these values until this project; it now reads the same route as the site.',
    },
    {
        feature: 'Projects',
        capability: 'Browse projects',
        app: '/api/projects/get_all_projects',
        web: '/api/projects/get_projects_for_investment',
        note: 'Different lists, both pre-existing. The web one is the investable set.',
    },
    {
        feature: 'Projects',
        capability: 'Project detail',
        shared: '/api/projects/details/[id]',
    },
    {
        feature: 'Bookings',
        capability: 'Place a booking',
        shared: '/api/bookings/create',
        note: 'The website currently goes through /api/v2/web/bookings/create, which is now redundant and should be retired.',
    },
    {
        feature: 'Bookings',
        capability: 'Eligibility to book',
        shared: 'Verified contact + verified NID, enforced in /api/bookings/create',
        note: 'Identical rules on both platforms since the NID check was turned on.',
    },
    {
        feature: 'Bookings',
        capability: 'Submit proof of payment',
        shared: '/api/bookings/proof-of-payment-upload/[id]',
    },
    {
        feature: 'Bookings',
        capability: 'Cancel a booking',
        shared: '/api/bookings/cancel',
    },
    {
        feature: 'Bookings',
        capability: 'List my bookings',
        app: '/api/investors/invested-projects/[id]',
        web: '/api/v2/investments/mine',
        note: 'Same payload. The web route takes the user from the token; the app route from the URL.',
    },
    {
        feature: 'Bookings',
        capability: 'Booking detail',
        app: '/api/bookings/details/[id]',
        web: '/api/v2/web/bookings/[id]',
        note: 'The app route is unauthenticated and readable by id. The web route checks ownership.',
    },
    {
        feature: 'Content',
        capability: 'Partner logos',
        shared: '/api/partnerships/all-partnerships',
    },
    {
        feature: 'Content',
        capability: 'Investor testimonials',
        shared: '/api/investor-testimonials/all-testimonials',
    },
    {
        feature: 'Content',
        capability: 'Blog',
        shared: '/api/blogs/list',
    },
    {
        feature: 'Partners',
        capability: 'Browse Shathi partners',
        app: '/api/partners/get_all_partners, /api/top_partners',
        web: '— shown per project only',
    },
    {
        feature: 'Notifications',
        capability: 'In-app notifications / push',
        app: '/api/my-notifications, /api/fcm',
        web: '— not built',
    },
    {
        feature: 'Shop',
        capability: 'Shathi Sheba products and orders',
        app: '/api/products, /api/user/order',
        web: '— not built',
    },
    {
        feature: 'Project updates',
        capability: 'Progress updates on an investment',
        app: '/api/live-update/list/[id]',
        web: '— not built',
        note: 'Worth adding to the website account area.',
    },
];
