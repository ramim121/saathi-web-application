/**
 * Configuration that is safe to ship to the browser.
 *
 * WHY THIS FILE EXISTS
 * `config/constants.ts` validates secrets and **throws** when one is missing.
 * That is correct on the server and wrong in a browser, where `process.env`
 * does not exist: 31 admin pages imported `API_URL` / `S3_URL` from it, so the
 * whole secrets module — including `required("JWT_SECRET")` — was compiled into
 * four client bundles. The first of those bundles to execute threw
 * `Missing required environment variable: JWT_SECRET` as an unhandled runtime
 * error in the page, even though `.env` was complete and the server was fine.
 *
 * No secret was ever leaked by this: Next only inlines `NEXT_PUBLIC_*` into
 * client code, so the browser copy of `process.env` held no values at all —
 * which is exactly why the lookup failed and it threw.
 *
 * Two rules follow, and they are the whole point of the split:
 *
 *   1. Anything a component renders imports from **here**.
 *   2. `config/constants.ts` is server-only. Importing it from a page is what
 *      caused this bug.
 *
 * The reads below are static (`process.env.NEXT_PUBLIC_X`, never
 * `process.env[name]`), because only static member access is substituted at
 * build time. A computed lookup compiles to a runtime read of an object that
 * does not exist in the browser.
 */

/**
 * Base for admin-panel fetches, with a trailing slash.
 *
 * Defaults to `/` — same origin — because every use is a page calling this very
 * application: the admin UI and the API are one Next app, and all 27 call sites
 * are `API_URL + "api/…"`. There are no server-side uses at all.
 *
 * Same-origin is not just tidier, it is what the code assumes. The previous
 * default was the absolute production origin, so the panel served from any
 * other host issued cross-origin requests that only worked because CORS was set
 * to `*`; and a stale value pointed the browser at a machine that was not
 * serving the panel, which failed as "Authentication required" because the
 * cookie did not travel with it.
 *
 * Override with `NEXT_PUBLIC_API_URL` only if the panel is ever served from a
 * different host than the API.
 */
export const API_URL: string = withTrailingSlash(process.env.NEXT_PUBLIC_API_URL || "/");

/** Public S3 origin serving project, partner, blog and testimonial images. */
export const S3_URL: string = withTrailingSlash(
    process.env.NEXT_PUBLIC_S3_URL ||
        process.env.S3_URL ||
        "https://saathi-production-2025.s3.ap-southeast-1.amazonaws.com/",
);

function withTrailingSlash(value: string): string {
    return value.endsWith("/") ? value : `${value}/`;
}
