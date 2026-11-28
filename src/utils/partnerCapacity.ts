import { Op, QueryTypes, type Transaction } from 'sequelize';
import sequelize from '@/config/db';
import { Project, ProjectPartner, ProjectPartnerInvestor, User } from '@/models/__associations';
import { heldSql, usesCapacity } from '@/utils/bookingHolds';
import {
    fitAllocation,
    isOpenProject,
    nextProjectTotal,
    summarizeCapacity,
    unitsLeft,
    type Allocation,
    type PartnerLoad,
    type ProjectCapacity,
} from '@/utils/partnerCapacityShared';

/**
 * Server side of partner capacity: every route that books, confirms, moves or
 * assigns units goes through here, so they cannot disagree.
 *
 * Each write locks its project rows first. Without that, two bookings checking
 * the same last units at the same moment would both pass.
 */

export class CapacityError extends Error {
    status: number;
    code?: string;
    details?: unknown;
    constructor(message: string, status = 400, code?: string, details?: unknown) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details;
    }
}

const n = (v: unknown) => Number(v ?? 0) || 0;

/** Always in id order, so two requests can never deadlock on each other. */
export async function lockProjects(ids: number[], transaction: Transaction): Promise<void> {
    const unique = Array.from(new Set(ids)).sort((a, b) => a - b);
    if (!unique.length) return;
    await sequelize.query('SELECT id_projects FROM projects WHERE id_projects IN (:ids) ORDER BY id_projects FOR UPDATE', {
        replacements: { ids: unique },
        type: QueryTypes.SELECT,
        transaction,
    });
}

/**
 * Each partner's paid units and the units held for them by unpaid bookings
 * still within their payment window (utils/bookingHolds.ts).
 *
 * `excludeBooking` leaves one booking's holds out of `pending`: confirming a
 * booking checks its own units against everyone else's.
 */
export async function partnerLoads(ids?: number[], transaction?: Transaction, opts: { excludeBooking?: number } = {}): Promise<PartnerLoad[]> {
    if (ids && ids.length === 0) return [];
    const exclude = Number.isInteger(opts.excludeBooking) && (opts.excludeBooking as number) > 0 ? (opts.excludeBooking as number) : 0;
    const replacements: Record<string, unknown> = {};
    if (ids) replacements.ids = ids;
    if (exclude) replacements.exclude = exclude;
    const rows = await sequelize.query<Record<string, unknown>>(
        `SELECT pp.id_project_partners AS idProjectPartners, pp.id_projects AS idProjects, pp.id_users AS idUsers,
                COALESCE(u.full_name, CONCAT('Partner #', pp.id_users)) AS fullName,
                pp.partner_unit_capacity AS capacity,
                COALESCE(SUM(CASE WHEN pi.investment_status = 'confirmed' THEN ppi.invested_unit END), 0) AS confirmed,
                COALESCE(SUM(CASE WHEN ${heldSql('pi', 'b')}${exclude ? ' AND pi.id_project_investment_bookings <> :exclude' : ''} THEN ppi.invested_unit END), 0) AS pending
           FROM project_partners pp
           LEFT JOIN users u ON u.id_users = pp.id_users
           LEFT JOIN project_partner_investors ppi ON ppi.id_project_partners = pp.id_project_partners
           LEFT JOIN project_investors pi ON pi.id_project_investors = ppi.id_project_investors
           LEFT JOIN project_investment_bookings b ON b.id_project_investment_bookings = pi.id_project_investment_bookings
          ${ids ? 'WHERE pp.id_projects IN (:ids)' : ''}
          GROUP BY pp.id_project_partners, pp.id_projects, pp.id_users, u.full_name, pp.partner_unit_capacity
          ORDER BY pp.id_project_partners`,
        { replacements: Object.keys(replacements).length ? replacements : undefined, type: QueryTypes.SELECT, transaction },
    );
    return rows.map((r) => ({
        idProjectPartners: n(r.idProjectPartners),
        idProjects: n(r.idProjects),
        idUsers: n(r.idUsers),
        fullName: String(r.fullName ?? ''),
        capacity: n(r.capacity),
        confirmed: n(r.confirmed),
        pending: n(r.pending),
    }));
}

export async function projectCapacities(ids?: number[], loads?: PartnerLoad[]): Promise<ProjectCapacity[]> {
    if (ids && ids.length === 0) return [];
    const partnerRows = loads ?? (await partnerLoads(ids));
    const rows = await sequelize.query<Record<string, unknown>>(
        `SELECT p.id_projects AS idProjects, p.project_name AS projectName, p.project_status AS projectStatus,
                p.location, p.duration, p.tenure, p.unit_investment_value AS unitValue, p.total_available_units AS totalUnits,
                COALESCE(l.confirmed, 0) AS confirmed, COALESCE(l.pending, 0) AS pending
           FROM projects p
           LEFT JOIN (
               SELECT pi.id_projects,
                      SUM(CASE WHEN pi.investment_status = 'confirmed' THEN pi.unit_purchased ELSE 0 END) AS confirmed,
                      SUM(CASE WHEN ${heldSql('pi', 'b')} THEN pi.unit_purchased ELSE 0 END) AS pending
                 FROM project_investors pi
                 LEFT JOIN project_investment_bookings b ON b.id_project_investment_bookings = pi.id_project_investment_bookings
                GROUP BY pi.id_projects
           ) l ON l.id_projects = p.id_projects
          ${ids ? 'WHERE p.id_projects IN (:ids)' : ''}
          ORDER BY p.id_projects DESC`,
        { replacements: ids ? { ids } : undefined, type: QueryTypes.SELECT },
    );
    return rows.map((r) =>
        summarizeCapacity(
            {
                idProjects: n(r.idProjects),
                projectName: String(r.projectName ?? ''),
                projectStatus: String(r.projectStatus ?? ''),
                location: (r.location as string) ?? null,
                duration: n(r.duration),
                tenure: String(r.tenure ?? ''),
                unitValue: n(r.unitValue),
                totalUnits: n(r.totalUnits),
                confirmed: n(r.confirmed),
                pending: n(r.pending),
            },
            partnerRows.filter((p) => p.idProjects === n(r.idProjects)),
        ),
    );
}

/**
 * Units that use capacity in a project (paid + held), optionally for one
 * investor, and leaving out one booking or one line (the booking being
 * confirmed, or the matured line a reinvestment replaces).
 */
export async function unitsUsed(
    args: { idProjects: number; idUsers?: number; excludeBooking?: number; excludeLine?: number },
    transaction?: Transaction,
): Promise<number> {
    const where = [`pi.id_projects = :idProjects`, usesCapacity('pi', 'b')];
    const replacements: Record<string, unknown> = { idProjects: args.idProjects };
    if (args.idUsers) {
        where.push('pi.id_users = :idUsers');
        replacements.idUsers = args.idUsers;
    }
    if (args.excludeBooking) {
        where.push('(pi.id_project_investment_bookings IS NULL OR pi.id_project_investment_bookings <> :excludeBooking)');
        replacements.excludeBooking = args.excludeBooking;
    }
    if (args.excludeLine) {
        where.push('pi.id_project_investors <> :excludeLine');
        replacements.excludeLine = args.excludeLine;
    }
    const rows = await sequelize.query<{ units: unknown }>(
        `SELECT IFNULL(SUM(pi.unit_purchased), 0) AS units
           FROM project_investors pi
           LEFT JOIN project_investment_bookings b ON b.id_project_investment_bookings = pi.id_project_investment_bookings
          WHERE ${where.join(' AND ')}`,
        { replacements, type: QueryTypes.SELECT, transaction },
    );
    return n(rows[0]?.units);
}

export type BookingLineInput = {
    idProjects: number;
    unitPurchased: number;
    projectPartners?: { idProjectPartners: number; investedUnit: number }[];
};

export type PlannedLine = {
    idProjects: number;
    units: number;
    moved: number;
    allocations: { idProjectPartners: number; investedUnit: number; amountInvested: number }[];
};

/**
 * Checks a booking against every limit and decides which partners hold it.
 * Call inside the booking's transaction.
 *
 * `strict` is for an admin who picked partners by hand: a choice that does not
 * fit is refused rather than quietly changed. An investor's booking is placed
 * wherever there is room, because the partner shown at checkout is tentative.
 *
 * Every limit counts paid units AND units held by other unpaid bookings that
 * are still within their payment window (utils/bookingHolds.ts): the project
 * total, the per-investor limit, and each partner's room. Units are placed
 * only where nobody holds them.
 *
 * Amounts are worked out here from the project's price. The client's figure
 * is not trusted: it is what investors later see as the money they put in.
 */
export async function planBooking(lines: BookingLineInput[], idUsers: number, transaction: Transaction, opts: { strict?: boolean } = {}): Promise<PlannedLine[]> {
    const ids = Array.from(new Set(lines.map((l) => Number(l.idProjects))));
    await lockProjects(ids, transaction);
    const projects = await Project.findAll({
        where: { idProjects: ids },
        attributes: ['idProjects', 'projectName', 'projectStatus', 'totalAvailableUnits', 'investorUnitCapacity', 'unitInvestmentValue'],
        transaction,
    });
    const projectById = new Map(projects.map((p: any) => [Number(p.idProjects), p]));
    const loads = await partnerLoads(ids, transaction);

    // Paid + held, per project and per investor.
    const usedRows = await sequelize.query<{ idProjects: unknown; idUsers: unknown; units: unknown }>(
        `SELECT pi.id_projects AS idProjects, pi.id_users AS idUsers, SUM(pi.unit_purchased) AS units
           FROM project_investors pi
           LEFT JOIN project_investment_bookings b ON b.id_project_investment_bookings = pi.id_project_investment_bookings
          WHERE pi.id_projects IN (:ids) AND ${usesCapacity('pi', 'b')}
          GROUP BY pi.id_projects, pi.id_users`,
        { replacements: { ids }, type: QueryTypes.SELECT, transaction },
    );
    const usedIn = new Map<number, number>();
    const heldBy = new Map<number, number>();
    for (const row of usedRows) {
        const id = Number(row.idProjects);
        usedIn.set(id, (usedIn.get(id) ?? 0) + n(row.units));
        if (Number(row.idUsers) === idUsers) heldBy.set(id, (heldBy.get(id) ?? 0) + n(row.units));
    }

    const inThisBooking = new Map<number, number>();
    const planned: PlannedLine[] = [];
    for (const line of lines) {
        const idProjects = Number(line.idProjects);
        const units = Number(line.unitPurchased);
        const project: any = projectById.get(idProjects);
        if (!project) throw new CapacityError('Project not found.', 404);
        const name = project.projectName;
        if (!isOpenProject(String(project.projectStatus))) throw new CapacityError(`${name} is closed for new bookings.`);

        const already = inThisBooking.get(idProjects) ?? 0;
        const total = n(project.totalAvailableUnits);
        const used = usedIn.get(idProjects) ?? 0;
        if (total > 0 && used + already + units > total) {
            throw new CapacityError(`${name} has ${Math.max(0, total - used - already)} unit(s) left.`, 400, 'PROJECT_CAPACITY');
        }
        const perInvestor = n(project.investorUnitCapacity);
        if (perInvestor > 0) {
            // Paid and booked-but-unpaid alike, so several unpaid bookings
            // cannot each pass the limit on their own.
            const held = heldBy.get(idProjects) ?? 0;
            if (held + already + units > perInvestor) {
                throw new CapacityError(`The limit in ${name} is ${perInvestor} unit(s) per investor, and ${held + already} are already booked.`, 400, 'INVESTOR_CAPACITY');
            }
        }

        const partners = loads.filter((l) => l.idProjects === idProjects);
        if (partners.length === 0) throw new CapacityError(`${name} has no partners assigned yet.`, 400, 'NO_PARTNERS');

        const requested: Allocation[] = [];
        for (const r of line.projectPartners ?? []) {
            const id = Number(r.idProjectPartners);
            const existing = requested.find((q) => q.idProjectPartners === id);
            if (existing) existing.units += Number(r.investedUnit);
            else requested.push({ idProjectPartners: id, units: Number(r.investedUnit) });
        }

        if (opts.strict) {
            if (requested.reduce((sum, r) => sum + r.units, 0) !== units) throw new CapacityError(`The partners' units for ${name} must add up to ${units}.`);
            for (const r of requested) {
                const p = partners.find((x) => x.idProjectPartners === r.idProjectPartners);
                if (!p) throw new CapacityError(`That partner is not on ${name}.`);
                if (p.capacity > 0 && p.confirmed + p.pending + r.units > p.capacity) {
                    throw new CapacityError(`${p.fullName} can take ${Math.max(0, p.capacity - p.confirmed - p.pending)} more unit(s) on ${name}.`, 400, 'PARTNER_CAPACITY');
                }
            }
        }

        const fit = fitAllocation(partners, units, requested);
        if (fit.shortfall > 0) {
            const room = partners.reduce((sum, p) => sum + (p.capacity > 0 ? Math.max(0, p.capacity - p.confirmed - p.pending) : units), 0);
            throw new CapacityError(`${name} has room for ${room} more unit(s) with its partners.`, 400, 'PARTNER_CAPACITY');
        }

        const unitValue = n(project.unitInvestmentValue);
        for (const a of fit.allocations) {
            const p = partners.find((x) => x.idProjectPartners === a.idProjectPartners);
            if (p) p.pending += a.units;
        }
        inThisBooking.set(idProjects, already + units);
        planned.push({
            idProjects,
            units,
            moved: fit.moved,
            allocations: fit.allocations.map((a) => ({ idProjectPartners: a.idProjectPartners, investedUnit: a.units, amountInvested: a.units * unitValue })),
        });
    }
    return planned;
}

export type PartnerMove = { from: string; to: string; units: number };

/**
 * Before a line is confirmed: does each partner still have room for it?
 *
 * Room is what is left after paid units and the holds of OTHER bookings still
 * within their payment window. A booking confirmed within its own window
 * always fits, because its units were held for it. One confirmed after its
 * deadline fits only where there is genuinely free room.
 *
 * Returns null when it fits. When it does not and the units can go elsewhere,
 * it refuses with the proposed moves unless `rebalance` is set, in which case
 * it applies them and returns what moved.
 */
export async function settleLinePartners(
    line: { idProjectInvestors: number; idProjects: number; unitPurchased: number; idProjectInvestmentBookings: number },
    projectName: string,
    rebalance: boolean,
    transaction: Transaction,
): Promise<PartnerMove[] | null> {
    const rows = (await ProjectPartnerInvestor.findAll({
        where: { idProjectInvestors: line.idProjectInvestors },
        order: [['idProjectPartnerInvestors', 'ASC']],
        transaction,
    })) as any[];
    const own = new Map<number, number>();
    for (const r of rows) own.set(Number(r.idProjectPartners), (own.get(Number(r.idProjectPartners)) ?? 0) + n(r.investedUnit));

    // This booking's own holds are left out: they must not block it.
    const loads = await partnerLoads([line.idProjects], transaction, { excludeBooking: line.idProjectInvestmentBookings });
    const name = (id: number) => loads.find((l) => l.idProjectPartners === id)?.fullName ?? `Partner #${id}`;
    const fits = Array.from(own.entries()).every(([id, units]) => {
        const p = loads.find((l) => l.idProjectPartners === id);
        return Boolean(p) && (p!.capacity === 0 || p!.confirmed + p!.pending + units <= p!.capacity);
    });
    if (fits) return null;

    const requested = Array.from(own.entries()).map(([idProjectPartners, units]) => ({ idProjectPartners, units }));
    const fit = fitAllocation(loads, n(line.unitPurchased), requested);
    if (fit.shortfall > 0) {
        throw new CapacityError(
            `${projectName}: the partners have no room for ${fit.shortfall} of these ${n(line.unitPurchased)} unit(s). Increase a partner's capacity in Partner assignment, then confirm again.`,
            409,
            'PARTNER_CAPACITY',
            { canMove: false, idProjects: line.idProjects },
        );
    }

    const wanted = new Map(fit.allocations.map((a) => [a.idProjectPartners, a.units]));
    const givers: { id: number; units: number }[] = [];
    const takers: { id: number; units: number }[] = [];
    own.forEach((units, id) => {
        if (units > (wanted.get(id) ?? 0)) givers.push({ id, units: units - (wanted.get(id) ?? 0) });
    });
    wanted.forEach((units, id) => {
        if (units > (own.get(id) ?? 0)) takers.push({ id, units: units - (own.get(id) ?? 0) });
    });
    const moves: PartnerMove[] = [];
    const giving = givers.map((g) => ({ ...g }));
    for (const t of takers) {
        let need = t.units;
        for (const g of giving) {
            if (need <= 0) break;
            const take = Math.min(need, g.units);
            if (take <= 0) continue;
            moves.push({ from: name(g.id), to: name(t.id), units: take });
            g.units -= take;
            need -= take;
        }
    }

    if (!rebalance) {
        throw new CapacityError(`${projectName}: a partner on this booking is full.`, 409, 'PARTNER_CAPACITY', { canMove: true, moves, idProjects: line.idProjects });
    }

    // Rewrite the allocation rows. A row that loses all its units is re-pointed
    // rather than deleted, because live updates reference it.
    const remaining = new Map(wanted);
    const pending = takers.map((t) => ({ ...t }));
    for (const row of rows) row.keep = 0;
    for (const row of rows) {
        const id = Number(row.idProjectPartners);
        const keep = Math.min(n(row.investedUnit), remaining.get(id) ?? 0);
        row.keep = keep;
        remaining.set(id, (remaining.get(id) ?? 0) - keep);
    }
    for (const row of rows) {
        const units = n(row.investedUnit);
        const perUnit = units > 0 ? n(row.amountInvested) / units : 0;
        let spare = units - row.keep;
        if (spare === 0) continue;
        if (row.keep > 0) {
            row.investedUnit = row.keep;
            row.amountInvested = row.keep * perUnit;
            await row.save({ transaction });
        } else {
            const target = pending.find((p) => p.units > 0)!;
            const take = Math.min(spare, target.units);
            row.idProjectPartners = target.id;
            row.investedUnit = take;
            row.amountInvested = take * perUnit;
            await row.save({ transaction });
            target.units -= take;
            spare -= take;
        }
        while (spare > 0) {
            const target = pending.find((p) => p.units > 0)!;
            const take = Math.min(spare, target.units);
            await ProjectPartnerInvestor.create(
                { idProjectInvestors: line.idProjectInvestors, idProjectPartners: target.id, investedUnit: take, amountInvested: take * perUnit } as any,
                { transaction },
            );
            target.units -= take;
            spare -= take;
        }
    }
    return moves;
}

export type AssignPair = { idProjects: number; idUsers: number; capacity: number };

/** Adds partners to projects, many at once. Pairs already assigned are skipped. */
export async function assignPartners(pairs: AssignPair[]) {
    const seen = new Set<string>();
    const unique = pairs.filter((p) => {
        const key = `${p.idProjects}:${p.idUsers}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
    const projectIds = Array.from(new Set(unique.map((p) => p.idProjects)));
    const userIds = Array.from(new Set(unique.map((p) => p.idUsers)));

    const transaction = await sequelize.transaction();
    try {
        await lockProjects(projectIds, transaction);
        const projects = (await Project.findAll({
            where: { idProjects: projectIds },
            attributes: ['idProjects', 'projectName', 'projectStatus', 'totalAvailableUnits'],
            transaction,
        })) as any[];
        if (projects.length !== projectIds.length) throw new CapacityError('A selected project no longer exists.', 404);
        const closed = projects.find((p) => !isOpenProject(String(p.projectStatus)));
        if (closed) throw new CapacityError(`${closed.projectName} is closed, so partners cannot be added to it.`);

        const partners = await User.findAll({
            where: { idUsers: userIds, userType: 'partner', partnerType: { [Op.in]: ['project', 'both'] }, status: { [Op.ne]: 'deleted' } },
            attributes: ['idUsers'],
            transaction,
        });
        if (partners.length !== userIds.length) throw new CapacityError('A selected person is not an active project partner.');

        const before = await partnerLoads(projectIds, transaction);
        const assigned = new Set(before.map((l) => `${l.idProjects}:${l.idUsers}`));
        const fresh = unique.filter((p) => !assigned.has(`${p.idProjects}:${p.idUsers}`));
        if (fresh.length) {
            await ProjectPartner.bulkCreate(
                fresh.map((p) => ({ idProjects: p.idProjects, idUsers: p.idUsers, partnerUnitCapacity: p.capacity })) as any,
                { transaction },
            );
        }

        const totals: { idProjects: number; projectName: string; from: number; to: number }[] = [];
        for (const project of projects) {
            const id = Number(project.idProjects);
            const loads = before.filter((l) => l.idProjects === id);
            const added = fresh.filter((p) => p.idProjects === id).reduce((sum, p) => sum + p.capacity, 0);
            if (!added || loads.some((l) => l.capacity === 0)) continue;
            const old = loads.reduce((sum, l) => sum + l.capacity, 0);
            const confirmed = loads.reduce((sum, l) => sum + l.confirmed, 0);
            const from = n(project.totalAvailableUnits);
            const to = nextProjectTotal(from, old, old + added, confirmed);
            if (to !== from) {
                await Project.update({ totalAvailableUnits: to } as any, { where: { idProjects: id }, transaction });
                totals.push({ idProjects: id, projectName: project.projectName, from, to });
            }
        }
        await transaction.commit();
        return { created: fresh.length, skipped: unique.length - fresh.length, totals };
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
}

/** Changes one partner's capacity. It can never drop below their paid units. */
export async function updateAssignmentCapacity(idProjectPartners: number, capacity: number) {
    const found = await ProjectPartner.findByPk(idProjectPartners, { attributes: ['idProjects'] });
    if (!found) throw new CapacityError('Assignment not found.', 404);
    const idProjects = Number((found as any).idProjects);

    const transaction = await sequelize.transaction();
    try {
        await lockProjects([idProjects], transaction);
        const loads = await partnerLoads([idProjects], transaction);
        const current = loads.find((l) => l.idProjectPartners === idProjectPartners);
        if (!current) throw new CapacityError('Assignment not found.', 404);
        if (capacity < current.confirmed) {
            throw new CapacityError(`${current.fullName} already holds ${current.confirmed} paid unit(s), so capacity cannot go below that.`);
        }
        await ProjectPartner.update({ partnerUnitCapacity: capacity } as any, { where: { idProjectPartners }, transaction });

        let total: { from: number; to: number } | null = null;
        if (!loads.some((l) => l.capacity === 0)) {
            const old = loads.reduce((sum, l) => sum + l.capacity, 0);
            const next = old - current.capacity + capacity;
            const confirmed = loads.reduce((sum, l) => sum + l.confirmed, 0);
            const project = (await Project.findByPk(idProjects, { attributes: ['totalAvailableUnits'], transaction })) as any;
            const from = n(project?.totalAvailableUnits);
            const to = nextProjectTotal(from, old, next, confirmed);
            if (to !== from) {
                await Project.update({ totalAvailableUnits: to } as any, { where: { idProjects }, transaction });
                total = { from, to };
            }
        }
        await transaction.commit();
        const warning =
            capacity < current.confirmed + current.pending
                ? `${current.fullName} has ${current.pending} unit(s) awaiting payment that no longer all fit. They will need another partner when confirmed.`
                : null;
        return { total, warning, left: unitsLeft({ capacity, confirmed: current.confirmed, pending: current.pending }) };
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
}

/** Removes a partner with no allocations from a project. */
export async function removeAssignment(idProjectPartners: number) {
    const found = await ProjectPartner.findByPk(idProjectPartners, { attributes: ['idProjects'] });
    if (!found) throw new CapacityError('Partner assignment not found', 404);
    const idProjects = Number((found as any).idProjects);

    const transaction = await sequelize.transaction();
    try {
        await lockProjects([idProjects], transaction);
        const loads = await partnerLoads([idProjects], transaction);
        const current = loads.find((l) => l.idProjectPartners === idProjectPartners);
        if (!current) throw new CapacityError('Partner assignment not found', 404);
        const project = (await Project.findByPk(idProjects, { attributes: ['totalAvailableUnits'], transaction })) as any;
        if (!loads.some((l) => l.capacity === 0)) {
            const old = loads.reduce((sum, l) => sum + l.capacity, 0);
            const confirmed = loads.reduce((sum, l) => sum + l.confirmed, 0);
            const from = n(project?.totalAvailableUnits);
            const to = nextProjectTotal(from, old, old - current.capacity, confirmed);
            if (to !== from) await Project.update({ totalAvailableUnits: to } as any, { where: { idProjects }, transaction });
        }
        await ProjectPartner.destroy({ where: { idProjectPartners }, transaction });
        await transaction.commit();
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
}
