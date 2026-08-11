/**
 * `knex-stringcase` ships ESM-only type declarations
 * (`dist/esm/main.d.ts`, reachable only under `moduleResolution: node16`
 * / `nodenext` / `bundler`). This project is on classic `node` resolution, so
 * TypeScript could see the file but refused to use it:
 *
 *   src/config/db.ts(4,28): error TS2307: Cannot find module 'knex-stringcase'
 *
 * Changing `moduleResolution` project-wide to fix one import would re-resolve
 * every dependency in a Next 13 app — a large blast radius for a one-line
 * problem. This ambient declaration states the shape we actually use instead.
 *
 * The package takes a Knex config, converts camelCase <-> snake_case at the
 * driver boundary, and returns a Knex config. That is the whole surface used in
 * `src/config/db.ts`.
 */
declare module 'knex-stringcase' {
    import type { Knex } from 'knex';

    interface KnexStringcaseOptions {
        /** Convert identifiers on the way into the database. Default: 'snakecase'. */
        appStringcase?: string | string[] | ((value: string) => string);
        /** Convert identifiers on the way back out. Default: 'camelcase'. */
        dbStringcase?: string | string[] | ((value: string) => string);
        /** Opt out of converting keys of returned rows. */
        ignoreStringcase?: (obj: unknown, name?: string) => boolean;
        recursiveStringcase?: boolean | ((obj: unknown, name?: string) => boolean);
    }

    export default function knexStringcase(
        config: Knex.Config & KnexStringcaseOptions,
    ): Knex.Config;
}
