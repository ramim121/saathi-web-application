import { Op } from 'sequelize';
import sequelize from '@/config/db';

/**
 * The `q` (search everything) parameter the admin list endpoints accept.
 *
 *   const q = searchTerm(req.query.q);
 *   if (q) where[Op.and] = [likeAny(q, ['fullName', 'phoneNumber'])];
 */

/** Trimmed, at most 100 characters; null when empty or not a string. */
export function searchTerm(q: unknown): string | null {
    if (typeof q !== 'string') return null;
    const t = q.trim().slice(0, 100);
    return t === '' ? null : t;
}

/** `%term%`, with LIKE's own wildcards in the term matched literally. */
export function likePattern(term: string): string {
    return `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/** Any of these model attributes contains the term. */
export function likeAny(term: string, attributes: string[]) {
    const pattern = likePattern(term);
    return { [Op.or]: attributes.map((a) => ({ [a]: { [Op.like]: pattern } })) };
}

/**
 * The usual `q` condition: any of the text attributes contains the term, or
 * (when the term is a number) the id attribute equals it.
 */
export function searchWhere(term: string, attributes: string[], idAttribute?: string) {
    const n = idAttribute ? numberIn(term) : null;
    const pattern = likePattern(term);
    return {
        [Op.or]: [...attributes.map((a) => ({ [a]: { [Op.like]: pattern } })), ...(n && idAttribute ? [{ [idAttribute]: n }] : [])],
    };
}

/** The pattern as an escaped SQL string, for subqueries in `literal(...)`. */
export function sqlLike(term: string): string {
    return sequelize.escape(likePattern(term));
}

/** A whole number in the term (a booking ref or an id), or null. */
export function numberIn(term: string): number | null {
    const n = Number(term.replace(/^#/, ''));
    return Number.isInteger(n) && n > 0 && n < 2_147_483_647 ? n : null;
}
