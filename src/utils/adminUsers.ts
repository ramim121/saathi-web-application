import { Op, literal, where as sqlWhere, type WhereOptions } from 'sequelize';
import { Bank, BankBranch, User, UserBank } from '@/models/__associations';
import { USERS_PAGE_SIZE } from '@/utils/adminUsersShared';

/**
 * The admin Users page, one page of rows at a time.
 *
 * The page used to server-render every user with every column and filter in
 * the browser (600 kB of page data at ~600 users, growing with each investor).
 * The filters below reproduce the old in-browser ones exactly, so results
 * don't change; only the work moved to the database.
 */

export { USERS_PAGE_SIZE };

export type UserFilters = {
    name?: string;
    phoneEmail?: string;
    userType?: string;
    status?: string;
    age?: string;
    joining?: string;
    nid?: string;
    email?: string;
    phone?: string;
};

/** What a table row needs. */
const LIST_ATTRIBUTES = [
    'idUsers', 'fullName', 'userType', 'profileImage', 'phoneNumber', 'email', 'age',
    'createdAt', 'disability', 'status', 'nidVerified', 'phoneVerified', 'emailVerified',
];

/** What the details dialog adds. */
const DETAIL_ATTRIBUTES = [
    ...LIST_ATTRIBUTES,
    'dateOfBirth', 'location', 'role', 'education', 'partnerType', 'interestedIn', 'skills', 'bio',
    'nidVerificationStatus', 'nidNumber',
];

/** LIKE pattern for "contains", with %, _ and \ in the input taken literally (as String.includes did). */
const contains = (s: string) => `%${s.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

function filterWhere(f: UserFilters): WhereOptions {
    const and: WhereOptions[] = [];
    if (f.name) and.push({ fullName: { [Op.like]: contains(f.name) } });
    if (f.phoneEmail) and.push({ [Op.or]: [{ phoneNumber: { [Op.like]: contains(f.phoneEmail) } }, { email: { [Op.like]: contains(f.phoneEmail) } }] });
    if (f.userType) and.push({ userType: { [Op.like]: contains(f.userType) } });
    if (f.status) and.push({ status: f.status });
    // Was `user.age && String(user.age) === filter`: exact text, and age 0 never matched.
    if (f.age) and.push({ age: { [Op.ne]: 0 } }, sqlWhere(literal('CAST(`User`.`age` AS CHAR)'), f.age));
    // Was dhakaDmy(createdAt).includes(filter): "d/m/yyyy" in Bangladesh time (UTC+6, no DST).
    if (f.joining) {
        and.push(sqlWhere(literal("DATE_FORMAT(DATE_ADD(`User`.`created_at`, INTERVAL 6 HOUR), '%e/%c/%Y')"), { [Op.like]: contains(f.joining) }));
    }
    if (f.nid) and.push({ nidVerified: f.nid });
    if (f.email) and.push({ emailVerified: f.email });
    if (f.phone) and.push({ phoneVerified: f.phone });
    return { [Op.and]: and };
}

export function readUserFilters(query: Record<string, string | string[] | undefined>): UserFilters {
    const one = (k: string) => {
        const v = query[k];
        return (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
    };
    return {
        name: one('name'),
        phoneEmail: one('phoneEmail'),
        userType: one('userType'),
        status: one('status'),
        age: one('age'),
        joining: one('joining'),
        nid: one('nid'),
        email: one('email'),
        phone: one('phone'),
    };
}

export async function listUsers(filters: UserFilters, page = 1, pageSize = USERS_PAGE_SIZE) {
    const size = Math.min(Math.max(1, Math.floor(pageSize) || USERS_PAGE_SIZE), 100);
    const current = Math.max(1, Math.floor(page) || 1);
    const { rows, count } = await User.findAndCountAll({
        attributes: [
            ...LIST_ATTRIBUTES,
            // Whether to offer the bank dialog, without shipping the accounts.
            [literal('(SELECT COUNT(*) FROM `user_banks` AS `ub` WHERE `ub`.`id_users` = `User`.`id_users`)'), 'bankCount'],
        ],
        where: filterWhere(filters),
        order: [['idUsers', 'DESC']],
        limit: size,
        offset: (current - 1) * size,
    });
    return {
        data: rows.map((r) => {
            const plain = r.get({ plain: true }) as Record<string, unknown>;
            return { ...plain, bankCount: Number(plain.bankCount) || 0 };
        }),
        total: count,
        page: current,
        totalPages: Math.max(1, Math.ceil(count / size)),
    };
}

/** One user for the details and bank dialogs. */
export async function getUserDetails(idUsers: number) {
    const user = await User.findOne({
        where: { idUsers },
        attributes: DETAIL_ATTRIBUTES,
        include: [
            {
                model: UserBank,
                attributes: ['accountHolderName', 'accountNumber'],
                include: [
                    { model: Bank, attributes: ['bankNameFull', 'bankNameShort'] },
                    { model: BankBranch, attributes: ['branchName', 'routingNumber'] },
                ],
            },
        ],
    });
    return user ? user.get({ plain: true }) : null;
}
