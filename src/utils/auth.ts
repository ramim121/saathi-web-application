import type { NextApiRequest, NextApiResponse } from "next";
import jwt from "jsonwebtoken";
import { JWT_SECRET, CORS_ALLOWED_ORIGINS } from "@/config/constants";
import JWTPayload from "@/types/JWTPayload";

/**
 * Shared auth guards.
 *
 * Until now every handler that wanted authentication re-implemented the same
 * six lines, and the handlers that forgot simply had no authentication at all —
 * which is how `POST /api/banks/update/[id]` ended up able to rewrite any
 * user's payout account with no token. Centralising it means a route is either
 * explicitly wrapped or explicitly public; there is no third state where the
 * author meant to check and didn't.
 *
 * Usage:
 *
 *   export default withCors(requireUser(async (req, res, auth) => {
 *     // auth.idUsers is trustworthy here
 *   }))
 *
 *   export default withCors(requireAdmin(handler))
 *   export default withCors(withOptionalUser(handler))   // auth may be null
 */

export type AuthContext = {
  idUsers: number;
  userType: string;
};

export type AuthedHandler = (
  req: NextApiRequest,
  res: NextApiResponse,
  auth: AuthContext,
) => unknown | Promise<unknown>;

export type MaybeAuthedHandler = (
  req: NextApiRequest,
  res: NextApiResponse,
  auth: AuthContext | null,
) => unknown | Promise<unknown>;

/**
 * Verifies the bearer token and returns its payload, or null.
 * Never throws — a malformed or expired token is simply "not authenticated".
 */
export function readAuth(req: NextApiRequest): AuthContext | null {
  const header = req.headers.authorization;
  if (!header) return null;

  const [scheme, token] = header.split(" ");
  if (!token || scheme?.toLowerCase() !== "bearer") return null;

  try {
    // verify() throws on a bad signature or expiry; decode() alone does not,
    // which is why several existing handlers trusted unverified tokens.
    const payload = jwt.verify(token, JWT_SECRET) as JWTPayload;
    if (!payload?.idUsers) return null;
    return { idUsers: Number(payload.idUsers), userType: String(payload.userType ?? "") };
  } catch {
    return null;
  }
}

/** 401 unless a valid token is present. */
export function requireUser(handler: AuthedHandler) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    if (req.method === "OPTIONS") return res.status(200).end();

    const auth = readAuth(req);
    if (!auth) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }
    return handler(req, res, auth);
  };
}

/** 401 without a token, 403 when the token is not an admin. */
export function requireAdmin(handler: AuthedHandler) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    if (req.method === "OPTIONS") return res.status(200).end();

    const auth = readAuth(req);
    if (!auth) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }
    if (auth.userType !== "admin") {
      return res.status(403).json({ success: false, message: "Access denied" });
    }
    return handler(req, res, auth);
  };
}

/** Always runs; `auth` is null when there is no valid token. */
export function withOptionalUser(handler: MaybeAuthedHandler) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    if (req.method === "OPTIONS") return res.status(200).end();
    return handler(req, res, readAuth(req));
  };
}

/**
 * True when the caller may act on a record belonging to `ownerId`: either it is
 * their own, or they are an admin. Use this for every by-ID route so an
 * authenticated user cannot walk other people's IDs.
 */
export function canAccess(auth: AuthContext, ownerId: number | string | null | undefined): boolean {
  if (auth.userType === "admin") return true;
  if (ownerId === null || ownerId === undefined) return false;
  return Number(ownerId) === auth.idUsers;
}

/**
 * CORS with a real allowlist.
 *
 * `micro-cors` only accepts a single origin string, so it cannot express
 * "these three hosts" — which is why every route ended up on `origin: '*'`.
 * This wrapper echoes the request's Origin header back only when it is on the
 * list, which is what a browser requires for a credentialed allowlist.
 *
 * `CORS_ALLOWED_ORIGINS=*` restores the permissive behaviour during migration.
 */
const ALLOW_ALL = CORS_ALLOWED_ORIGINS.includes("*");

const ALLOW_METHODS = "GET,POST,PUT,DELETE,OPTIONS";
const ALLOW_HEADERS = "X-Requested-With,Authorization,Content-Type,environment";

export function withCors<H extends (req: NextApiRequest, res: NextApiResponse) => unknown>(
  handler: H,
): H {
  return (async (req: NextApiRequest, res: NextApiResponse) => {
    const origin = req.headers.origin;

    if (ALLOW_ALL) {
      res.setHeader("Access-Control-Allow-Origin", "*");
    } else if (origin && CORS_ALLOWED_ORIGINS.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      // Caches must not serve one origin's response to another.
      res.setHeader("Vary", "Origin");
    }

    res.setHeader("Access-Control-Allow-Methods", ALLOW_METHODS);
    res.setHeader("Access-Control-Allow-Headers", ALLOW_HEADERS);
    res.setHeader("Access-Control-Max-Age", "86400");

    if (req.method === "OPTIONS") return res.status(204).end();

    return handler(req, res);
  }) as H;
}
