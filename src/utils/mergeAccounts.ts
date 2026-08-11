import { QueryTypes, Transaction } from 'sequelize';
import sequelize from '@/config/db';
import { User } from '@/models/__associations';
import type { UserModel } from '@/models/User';

/**
 * Joining two accounts that belong to one person.
 *
 * THE ONLY IMPLEMENTATION. `db/merge-accounts.ts` calls this rather than
 * repeating it: a merge rewrites the owner of bookings, investments and bank
 * details, and two copies of that logic drifting apart is how somebody's
 * investments end up under an account they cannot sign into.
 *
 * WHAT PROOF IS REQUIRED IS *NOT* DECIDED HERE
 * This function does the moving. The rule that a merge needs both channels
 * proved — an SMS code for the phone and an emailed code for the address —
 * belongs to the route, because the ops script is run by a human who has
 * already checked and cannot be asked for a code.
 *
 * NOTHING IS DELETED
 * The loser keeps its row with `status='merged'` and `mergedInto` naming the
 * survivor. That is what keeps the audit trail readable and the merge
 * reversible.
 */

/**
 * Tables excluded from the sweep.
 *
 * `users` is the thing being merged. The `_bkp_` table is a snapshot, and
 * rewriting a backup destroys the only property that makes it useful.
 */
const EXCLUDED_TABLES = new Set(['users', 'project_investors_bkp_06052026']);

/**
 * Fields the survivor may inherit into a gap. Never overwritten: the survivor
 * is the account the person actually uses, and replacing their name with an
 * older copy is data loss wearing a merge costume.
 *
 * `password` is deliberately absent.
 */
const INHERITABLE = [
    'fullName', 'fullNameBn', 'email', 'phoneNumber', 'gender', 'profileImage',
    'dateOfBirth', 'location', 'bio', 'nidNumber', 'nidImageFront', 'nidImageBack',
    'googleId', 'appleId',
] as const;

/**
 * Verification flags travel with the value they describe.
 *
 * They move when the survivor took the value, and ALSO when both sides already
 * hold the same value — which is the case that matters, because two accounts
 * on one address inherit nothing and would otherwise leave the survivor with
 * `emailVerified='no'` on an address the other row had proved. The next Google
 * sign-in would then miss the lookup and create a third account.
 *
 * Only ever an upgrade: a 'no' never overwrites a 'yes'.
 */
const FLAGS_FOR: Record<string, readonly string[]> = {
    email: ['emailVerified', 'googleLogin', 'appleLogin'],
    phoneNumber: ['phoneVerified'],
    nidNumber: ['nidVerified', 'nidVerificationStatus'],
};

export type MergePlan = {
    survivorId: number;
    loserId: number;
    inherits: Record<string, unknown>;
    moves: Array<{ table: string; column: string; rows: number }>;
    totalRows: number;
};

export type MergeRefusal = { ok: false; code: string; message: string };
export type MergeOk = { ok: true; plan: MergePlan };

/** Discovered from the live schema, so a table added later is not silently left behind. */
async function userIdTables(): Promise<Array<{ table: string; column: string }>> {
    const rows = await sequelize.query<{ TABLE_NAME: string; COLUMN_NAME: string }>(
        `SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND COLUMN_NAME IN ('id_users', 'ordered_by')
          ORDER BY TABLE_NAME`,
        { type: QueryTypes.SELECT },
    );
    return rows
        .filter((r) => !EXCLUDED_TABLES.has(r.TABLE_NAME))
        .map((r) => ({ table: r.TABLE_NAME, column: r.COLUMN_NAME }));
}

function isEmpty(value: unknown): boolean {
    return value === null || value === undefined || String(value).trim() === '';
}

async function countRows(table: string, column: string, idUsers: number): Promise<number> {
    const [row] = await sequelize.query<{ n: number }>(
        `SELECT COUNT(*) n FROM \`${table}\` WHERE \`${column}\` = :id`,
        { type: QueryTypes.SELECT, replacements: { id: idUsers } },
    );
    return Number(row?.n ?? 0);
}

/**
 * Which account should survive.
 *
 * Holdings dominate. After a merge the survivor holds both channels verified
 * either way, so the verification flags say nothing about the outcome — they
 * only decide which row number is kept. What does differ is how many financial
 * rows have to be rewritten, and the safest merge rewrites fewest.
 *
 * NID is the exception and stays heavy: it is an identity decision an admin
 * made about a specific account, with a scan attached.
 */
function survivorScore(user: UserModel, holdings: number): number {
    let score = holdings * 100;
    if (user.nidVerified === 'yes') score += 500;
    if (user.phoneVerified === 'yes') score += 10;
    if (user.emailVerified === 'yes') score += 10;
    if (user.googleLogin === 'yes' || user.appleLogin === 'yes') score += 5;
    if (user.fullName) score += 1;
    return score;
}

/**
 * Works out what a merge would do, without doing it.
 *
 * Separate from `applyMerge` so the website can show the person exactly what is
 * about to happen — "your 2 bookings move across" — before they agree. A merge
 * they did not understand is one they will ask to have undone.
 */
export async function planMerge(
    a: UserModel,
    b: UserModel,
    forcedSurvivorId?: number,
): Promise<MergeOk | MergeRefusal> {
    if (a.idUsers === b.idUsers) {
        return { ok: false, code: 'SAME_ACCOUNT', message: 'That is the same account.' };
    }
    for (const user of [a, b]) {
        if (user.status === 'merged') {
            return {
                ok: false,
                code: 'ALREADY_MERGED',
                message: `Account #${user.idUsers} has already been merged into #${user.mergedInto}.`,
            };
        }
        if (user.status === 'deleted') {
            return {
                ok: false,
                code: 'DELETED',
                message: 'One of these accounts was deleted. Contact support to restore it first.',
            };
        }
    }

    const tables = await userIdTables();

    const holdings = new Map<number, number>();
    for (const user of [a, b]) {
        let total = 0;
        for (const { table, column } of tables) total += await countRows(table, column, user.idUsers as number);
        holdings.set(user.idUsers as number, total);
    }

    let survivor: UserModel;
    let loser: UserModel;

    if (forcedSurvivorId) {
        if (![a.idUsers, b.idUsers].includes(forcedSurvivorId)) {
            return { ok: false, code: 'BAD_SURVIVOR', message: 'That account is not part of this merge.' };
        }
        survivor = a.idUsers === forcedSurvivorId ? a : b;
        loser = a.idUsers === forcedSurvivorId ? b : a;
    } else {
        const scoreA = survivorScore(a, holdings.get(a.idUsers as number) ?? 0);
        const scoreB = survivorScore(b, holdings.get(b.idUsers as number) ?? 0);
        [survivor, loser] = scoreA >= scoreB ? [a, b] : [b, a];
    }

    const inherits: Record<string, unknown> = {};
    const survivorRow = survivor as unknown as Record<string, unknown>;
    const loserRow = loser as unknown as Record<string, unknown>;

    for (const field of INHERITABLE) {
        if (isEmpty(loserRow[field])) continue;

        const sameValue =
            !isEmpty(survivorRow[field]) &&
            String(survivorRow[field]).trim().toLowerCase() ===
                String(loserRow[field]).trim().toLowerCase();

        if (isEmpty(survivorRow[field])) {
            inherits[field] = loserRow[field];
        } else if (!sameValue) {
            continue;
        }

        for (const flag of FLAGS_FOR[field] ?? []) {
            if (isEmpty(loserRow[flag])) continue;
            if (survivorRow[flag] === 'yes' && loserRow[flag] !== 'yes') continue;
            if (survivorRow[flag] === loserRow[flag]) continue;
            inherits[flag] = loserRow[flag];
        }
    }

    const moves: MergePlan['moves'] = [];
    for (const { table, column } of tables) {
        const rows = await countRows(table, column, loser.idUsers as number);
        if (rows > 0) moves.push({ table, column, rows });
    }

    return {
        ok: true,
        plan: {
            survivorId: survivor.idUsers as number,
            loserId: loser.idUsers as number,
            inherits,
            moves,
            totalRows: moves.reduce((sum, m) => sum + m.rows, 0),
        },
    };
}

/**
 * Carries out a plan. All or nothing.
 *
 * A merge that failed half way would leave bookings owned by an account that
 * can no longer sign in, so every statement runs in one transaction.
 */
export async function applyMerge(plan: MergePlan): Promise<{ movedRows: number }> {
    return sequelize.transaction(async (t: Transaction) => {
        let movedRows = 0;

        for (const { table, column, rows } of plan.moves) {
            await sequelize.query(
                `UPDATE \`${table}\` SET \`${column}\` = :survivor WHERE \`${column}\` = :loser`,
                {
                    type: QueryTypes.UPDATE,
                    replacements: { survivor: plan.survivorId, loser: plan.loserId },
                    transaction: t,
                },
            );
            movedRows += rows;
        }

        /*
         * Blank the loser's identity columns BEFORE writing them onto the
         * survivor.
         *
         * Migration 010's unique index covers live accounts, and inside this
         * transaction both rows are still live — writing the same address twice
         * would trip it. Blanking first also means a merged row can never be
         * found by an email or phone lookup, which is what we want: the login
         * belongs to the survivor now.
         *
         * The values are not lost; they are on the survivor.
         */
        await sequelize.query(
            `UPDATE users
                SET email = NULL, phone_number = NULL, google_id = NULL, apple_id = NULL,
                    status = 'merged', merged_into = :survivor, merged_at = NOW(), updated_at = NOW()
              WHERE id_users = :loser`,
            {
                type: QueryTypes.UPDATE,
                replacements: { survivor: plan.survivorId, loser: plan.loserId },
                transaction: t,
            },
        );

        if (Object.keys(plan.inherits).length > 0) {
            await User.update(plan.inherits, {
                where: { idUsers: plan.survivorId },
                transaction: t,
            });
        }

        return { movedRows };
    });
}
