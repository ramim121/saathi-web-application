import type { Model, ModelStatic, Order } from "sequelize";

/**
 * Builds a Sequelize `order` clause from untrusted `orderBy` / `orderType`
 * query parameters.
 *
 * Two problems with the pattern this replaces —
 * `order: [[orderBy as string, orderType === 'DESC' ? 'DESC' : 'ASC']]`:
 *
 * 1. The `as string` is a compile-time assertion only. When the caller omits
 *    `orderBy` the runtime value is `undefined`, and Sequelize fails deep
 *    inside the query generator with
 *    `Cannot read properties of undefined (reading '_modelAttribute')`,
 *    which every list handler then reports as a bare 400. The admin UI always
 *    sends the parameter, so this only bites other callers — the website
 *    proxy, curl, a bookmarked URL with a trimmed query string.
 *
 * 2. The value is passed through unchecked. Sequelize quotes it as an
 *    identifier, so it is not a straightforward injection, but an unknown
 *    column still reaches MySQL and produces a 500-ish error surfaced to the
 *    user rather than a clean rejection.
 *
 * Validating against the model's own attributes fixes both: a known column
 * sorts exactly as before, anything else falls back instead of failing.
 */
export function safeOrder<M extends Model>(
    model: ModelStatic<M>,
    orderBy: unknown,
    orderType: unknown,
    fallback: string,
    // Each handler had its own default direction; pass the one it already used
    // so sort order does not silently change for the admin UI.
    defaultDirection: "ASC" | "DESC" = "ASC",
): Order {
    const upper = typeof orderType === "string" ? orderType.toUpperCase() : "";
    const direction = upper === "ASC" || upper === "DESC" ? upper : defaultDirection;

    const attributes = model.getAttributes();
    const requested = typeof orderBy === "string" ? orderBy : "";
    const column = Object.prototype.hasOwnProperty.call(attributes, requested)
        ? requested
        : fallback;

    return [[column, direction]];
}
