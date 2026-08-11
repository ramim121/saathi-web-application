/**
 * Runtime configuration.
 *
 * Every value here used to carry a hardcoded fallback — live RDS credentials,
 * AWS keys, the BulkSMS key, the Apple private key and the JWT secret — and the
 * file is tracked in git. Those values must be treated as compromised and
 * rotated; see SECURITY-REMEDIATION.md.
 *
 * There are deliberately NO fallbacks now. A missing secret throws on startup
 * rather than silently falling back to a value that is public on GitHub. Copy
 * `.env.example` to `.env` and fill it in — `.env` is gitignored.
 *
 * `optional()` is used only for values that genuinely have a safe default.
 */

/**
 * True only in Node. Webpack strips server branches from client bundles, and it
 * also tells us when a stray import has pulled this module into the browser.
 */
const isServer = typeof window === "undefined";

function required(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    // In a browser there is no `process.env` to read, so a missing value here
    // means "this module should not be in this bundle" — not "the server is
    // misconfigured". Throwing produced an unhandled runtime error on four
    // admin pages while the server itself was perfectly configured. Fail loudly
    // on the server, stay inert in the browser.
    //
    // No secret is exposed by returning "": Next inlines only NEXT_PUBLIC_*
    // variables, so the client never had the real value in the first place.
    if (!isServer) return "";

    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Copy .env.example to .env and set it. See SECURITY-REMEDIATION.md.`,
    );
  }
  return value;
}

function optional(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.trim() ? value : fallback;
}

function optionalNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw || !raw.trim()) return fallback;
  const parsed = Number(raw);
  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be a number, got: ${raw}`);
  }
  return parsed;
}

/**
 * Public, non-secret values.
 *
 * Re-exported so existing server-side imports keep working, but **pages and
 * components must import these from `@/config/public`**. Importing them from
 * here drags the whole secrets module into the client bundle, which is what
 * broke the admin panel with `Missing required environment variable: JWT_SECRET`.
 */
export { API_URL, S3_URL } from "./public";

/**
 * Signs every session token. Rotating this invalidates all existing sessions —
 * users sign in again once. That is the correct trade, because the previous
 * value is public.
 */
export const JWT_SECRET = required("JWT_SECRET");

/* ---------------------------------------------------------------- SMS ---- */

export const BULK_SMS_API_KEY = required("BULK_SMS_API_KEY");
export const BULK_SMS_SENDER_ID = required("BULK_SMS_SENDER_ID");

/**
 * OTP lifetime in milliseconds. Was `1 * 60 * 1000` behind a comment claiming
 * five minutes, and the env override was read as a string and then used in
 * arithmetic — which concatenated instead of adding. Both fixed.
 */
export const OTP_EXPIRY = optionalNumber("OTP_EXPIRY", 5 * 60 * 1000);

/** Seconds a caller must wait before requesting another OTP for a number. */
export const OTP_RESEND_COOLDOWN = optionalNumber("OTP_RESEND_COOLDOWN", 60);

/** Wrong-code attempts allowed before the code is burned. */
export const OTP_MAX_ATTEMPTS = optionalNumber("OTP_MAX_ATTEMPTS", 5);

/**
 * App-store review account. Both must be set for the bypass to exist, and it is
 * only honoured when OTP_REVIEW_ENABLED is explicitly "true" — so it can be
 * turned on for a review build and off everywhere else. Previously this was a
 * hardcoded phone/OTP pair in the source of a public repo.
 */
export const OTP_REVIEW_ENABLED = optional("OTP_REVIEW_ENABLED", "false") === "true";
export const OTP_REVIEW_PHONE = optional("OTP_REVIEW_PHONE", "");
export const OTP_REVIEW_CODE = optional("OTP_REVIEW_CODE", "");

/* ----------------------------------------------------------------- S3 ---- */

export const S3_BUCKET_NAME = required("S3_BUCKET_NAME");
export const S3_BUCKET_REGION = required("S3_BUCKET_REGION");
export const S3_BUCKET_ACCESS_KEY = required("S3_BUCKET_ACCESS_KEY");
export const S3_BUCKET_SECRET_KEY = required("S3_BUCKET_SECRET_KEY");
// S3_URL is re-exported from ./public at the top of this file — it is a public
// bucket origin the browser needs, not a credential.

/* --------------------------------------------------------------- MySQL --- */

export const DB_NAME = required("DB_NAME");
export const DB_USER = required("DB_USER");
export const DB_PASSWORD = required("DB_PASSWORD");
export const DB_HOST = required("DB_HOST");
export const DB_PORT = optionalNumber("DB_PORT", 3306);

/* -------------------------------------------------------------- Social --- */

export const GOOGLE_CLIENT_ID = required("GOOGLE_CLIENT_ID");

export const APPLE_CLIENT_ID = optional("APPLE_CLIENT_ID", "com.digigram.saathi");
export const APPLE_TEAM_ID = required("APPLE_TEAM_ID");
export const APPLE_KEY_ID = required("APPLE_KEY_ID");
/**
 * PEM private key. In `.env` write it on one line with literal `\n` escapes;
 * they are expanded back to real newlines here.
 */
export const APPLE_PRIVATE_KEY = required("APPLE_PRIVATE_KEY").replace(/\\n/g, "\n");

/* ----------------------------------------------------------------- SES --- */

export const SES_AWS_ACCESS_KEY_ID = required("SES_AWS_ACCESS_KEY_ID");
export const SES_AWS_SECRET_ACCESS_KEY = required("SES_AWS_SECRET_ACCESS_KEY");
export const SES_AWS_REGION = optional("SES_AWS_REGION", "ap-northeast-1");

/**
 * Envelope sender for transactional mail.
 *
 * Was written out at each of the two call sites in the notification queue, so
 * changing it meant finding both. Must stay an address SES has verified for
 * this account or every send fails with MessageRejected.
 */
export const EMAIL_FROM = optional(
  "EMAIL_FROM",
  "Shathi <msg@notification.n.digigramventures.com>",
);

/* ----------------------------------------------- email verification ------ */

/** How long a verification code and link stay valid, in milliseconds. */
export const EMAIL_VERIFICATION_EXPIRY = optionalNumber(
  "EMAIL_VERIFICATION_EXPIRY",
  30 * 60 * 1000,
);

/**
 * Seconds before another code can be requested for the same account.
 *
 * Longer than the SMS cooldown on purpose: email delivery is slower and less
 * predictable, so a short window mostly produces people holding three codes and
 * trying the wrong one.
 */
export const EMAIL_VERIFICATION_RESEND_COOLDOWN = optionalNumber(
  "EMAIL_VERIFICATION_RESEND_COOLDOWN",
  120,
);

/**
 * Wrong-code attempts before the code is burned.
 *
 * The code is six digits — a million possibilities — so this is less critical
 * than the four-digit SMS equivalent, but it is what stops an unlimited
 * guessing loop against a known address.
 */
export const EMAIL_VERIFICATION_MAX_ATTEMPTS = optionalNumber(
  "EMAIL_VERIFICATION_MAX_ATTEMPTS",
  6,
);

/**
 * Public origin of the website, used to build verification links.
 *
 * No trailing slash — callers append a path beginning with one. A wrong value
 * here sends people to a link that 404s, so it is worth setting explicitly per
 * environment rather than relying on the default.
 */
export const WEB_BASE_URL = optional(
  "WEB_BASE_URL",
  "https://new.digigramventures.com",
).replace(/\/+$/, "");

/* ---------------------------------------------------------------- CORS --- */

/**
 * Comma-separated origins allowed to call this API from a browser.
 * `*` keeps the old permissive behaviour — set a real list in production.
 */
export const CORS_ALLOWED_ORIGINS = optional("CORS_ALLOWED_ORIGINS", "*")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
