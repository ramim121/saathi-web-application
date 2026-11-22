import type { NextApiRequest } from 'next';

/**
 * Idempotency keys for write routes that money depends on.
 *
 * WHY
 * The app's booking button could be tapped twice while the first request was
 * still running, and `bookings/create` has no way to tell a retry from a new
 * booking, so a double tap placed two bookings. A client that sends an
 * `Idempotency-Key` header (any unique string per intended action, up to 128
 * characters) now gets one booking: a repeat that arrives while the first is
 * running is refused with 409, and a repeat after it finished receives the
 * same response again.
 *
 * Requests without the header behave exactly as before, so shipped apps and
 * the website are unaffected until they start sending it.
 *
 * SCOPE
 * Kept in this process's memory for ten minutes. That covers double taps and
 * client retries, which arrive within seconds at the same process; it is not
 * meant to survive a restart. Keys are namespaced by user, so one account
 * cannot replay another's response.
 */

type Entry = { at: number; done: boolean; status?: number; body?: unknown };

const TTL_MS = 10 * 60 * 1000;
const store = new Map<string, Entry>();

function sweep(now: number): void {
    store.forEach((entry, key) => {
        if (now - entry.at > TTL_MS) store.delete(key);
    });
}

/** The namespaced key for this request, or null when the header is absent or unusable. */
export function idempotencyKey(req: NextApiRequest, route: string, idUsers: number): string | null {
    const raw = req.headers['idempotency-key'];
    const value = Array.isArray(raw) ? raw[0] : raw;
    if (!value || typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > 128) return null;
    return `${route}:${idUsers}:${trimmed}`;
}

export type IdempotencyStart =
    | { kind: 'new' }
    | { kind: 'in-flight' }
    | { kind: 'replay'; status: number; body: unknown };

/** Call before doing the work. */
export function beginIdempotent(key: string): IdempotencyStart {
    const now = Date.now();
    sweep(now);
    const existing = store.get(key);
    if (existing && existing.done && existing.status !== undefined) {
        return { kind: 'replay', status: existing.status, body: existing.body };
    }
    if (existing && !existing.done) return { kind: 'in-flight' };
    store.set(key, { at: now, done: false });
    return { kind: 'new' };
}

/** Call with the response once the work succeeded, so a repeat gets the same answer. */
export function finishIdempotent(key: string | null, status: number, body: unknown): void {
    if (!key) return;
    store.set(key, { at: Date.now(), done: true, status, body });
}

/** Call when the work failed, so the client may try again with the same key. */
export function abandonIdempotent(key: string | null): void {
    if (key) store.delete(key);
}
