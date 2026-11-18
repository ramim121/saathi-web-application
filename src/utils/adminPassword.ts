/**
 * Password rules for admin accounts, shared by the API routes and the pages
 * (no server-only imports here, so pages can use it).
 *
 * Admin sign-in (api/login) is email + password checked with bcrypt.
 */
export const ADMIN_PASSWORD_MIN = 8;
export const ADMIN_PASSWORD_MAX = 128;
