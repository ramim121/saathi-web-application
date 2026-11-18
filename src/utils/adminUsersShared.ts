/**
 * Shared by the Users page (browser) and src/utils/adminUsers.ts (server).
 * Keep server-only imports out of this file: the page imports it, and anything
 * it imports ends up in the browser bundle.
 */
export const USERS_PAGE_SIZE = 10;
