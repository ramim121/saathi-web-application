import { Op, type Transaction } from 'sequelize';
import { Project, ProjectInvestor, ProjectPartner, ProjectPartnerInvestor, User } from '@/models/__associations';
import { partnerLoads } from '@/utils/partnerCapacity';
import { fitAllocation, nextProjectTotal, unitsLeft, type PartnerLoad } from '@/utils/partnerCapacityShared';

/**
 * Where a reinvestment's units go: split round robin across the project's
 * partners (the same fitAllocation rule as an investor's booking in the app),
 * never one partner chosen by hand.
 *
 * An admin may make room in the same step when the partners do not have room
 * for all the units: raise existing partners' capacity, and/or assign new
 * partners to the project with a capacity. The raises are checked here (only up, never
 * below what a partner already holds) and, with `apply`, saved in the
 * caller's transaction together with the project's unit total, which follows
 * the partners' capacity the same way as when capacity is edited on the
 * project (nextProjectTotal).
 *
 * The same function answers the dialog's live preview (apply: false) and the
 * save (apply: true), so what the admin sees is what is recorded.
 */

export type CapacityRaise = { idProjectPartners: number; capacity: number };
/** A partner not yet on the project, to be assigned with this capacity. */
export type NewPartner = { idUsers: number; capacity: number };

/** Who can be assigned: active project partners (not deleted). */
export const assignableWhere = { userType: 'partner', partnerType: { [Op.in]: ['project', 'both'] }, status: { [Op.ne]: 'deleted' } };

export type AllocationPartner = {
    idProjectPartners: number;
    fullName: string;
    /** Capacity before any raise in this request; 0 means no limit. */
    capacity: number;
    /** Capacity used for the plan (the raise, when one was asked for). */
    plannedCapacity: number;
    confirmed: number;
    pending: number;
    /** Room before this reinvestment, with the planned capacity; null = no limit. */
    left: number | null;
    /** Units this reinvestment puts with the partner. */
    units: number;
    /** Assigned to the project by this reinvestment (id is -idUsers until saved). */
    isNew?: boolean;
    idUsers?: number;
};

export type AllocationPlan = {
    partners: AllocationPartner[];
    allocations: { idProjectPartners: number; units: number }[];
    /** Units no partner has room for, even after the raises. */
    shortfall: number;
    /** Units the project has left after the raises (null = no project limit). */
    projectLeft: number | null;
    projectTotal: { from: number; to: number } | null;
    /** What stops the reinvestment, in words for the admin; null when it fits. */
    problem: string | null;
    /** Machine-readable reason, so the dialog can offer the capacity editor. */
    code: 'partner_capacity' | 'project_total' | 'investor_cap' | 'no_partners' | 'bad_raise' | null;
};

const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export async function planReinvestAllocation(
    args: {
        idProjects: number;
        units: number;
        idUsers: number;
        /** The matured line being reinvested: its own units never count against room. */
        leavingLine?: number;
        raises?: CapacityRaise[];
        newPartners?: NewPartner[];
    },
    transaction?: Transaction,
    opts: { apply?: boolean } = {},
): Promise<AllocationPlan> {
    const units = Math.max(0, Math.floor(n(args.units)));
    const leaving = Number.isInteger(args.leavingLine) && (args.leavingLine as number) > 0 ? (args.leavingLine as number) : 0;
    const empty = (problem: string, code: AllocationPlan['code']): AllocationPlan => ({
        partners: [], allocations: [], shortfall: units, projectLeft: null, projectTotal: null, problem, code,
    });

    const project = (await Project.findByPk(args.idProjects, {
        attributes: ['projectName', 'totalAvailableUnits', 'investorUnitCapacity'],
        transaction,
    })) as any;
    if (!project) return empty('Project not found.', 'no_partners');

    // Partner loads, without the matured line's own units if it still counts.
    let loads: PartnerLoad[] = await partnerLoads([args.idProjects], transaction);
    if (leaving) {
        const line = (await ProjectInvestor.findByPk(leaving, { attributes: ['investmentStatus', 'idProjects'], transaction })) as any;
        if (line && Number(line.idProjects) === args.idProjects && ['confirmed', 'booked'].includes(String(line.investmentStatus))) {
            const rows = (await ProjectPartnerInvestor.findAll({ where: { idProjectInvestors: leaving }, attributes: ['idProjectPartners', 'investedUnit'], transaction })) as any[];
            const field = String(line.investmentStatus) === 'confirmed' ? 'confirmed' : 'pending';
            loads = loads.map((l) => {
                const mine = rows.filter((r) => Number(r.idProjectPartners) === l.idProjectPartners).reduce((s, r) => s + n(r.investedUnit), 0);
                return mine ? { ...l, [field]: Math.max(0, l[field] - mine) } : l;
            });
        }
    }
    // New partners for this project, as partners with no units yet. Until they
    // are saved their id is -idUsers, so the split can name them.
    const wanted = new Map<number, number>();
    for (const np of args.newPartners ?? []) {
        const idUsers = Math.floor(n(np.idUsers));
        const cap = Math.floor(n(np.capacity));
        if (idUsers <= 0) continue;
        if (cap < 1) return empty('Give each new partner a capacity of at least 1 unit.', 'bad_raise');
        if (loads.some((l) => l.idUsers === idUsers)) return empty('A partner you are adding is already on this project. Raise their capacity instead.', 'bad_raise');
        wanted.set(idUsers, cap);
    }
    let added: PartnerLoad[] = [];
    if (wanted.size) {
        const users = (await User.findAll({
            where: { idUsers: Array.from(wanted.keys()), ...assignableWhere } as any,
            attributes: ['idUsers', 'fullName'],
            transaction,
        })) as any[];
        if (users.length !== wanted.size) return empty('A partner you are adding is not an active project partner.', 'bad_raise');
        added = users.map((u) => ({
            idProjectPartners: -Number(u.idUsers),
            idProjects: args.idProjects,
            idUsers: Number(u.idUsers),
            fullName: String(u.fullName || `Partner #${u.idUsers}`),
            capacity: wanted.get(Number(u.idUsers)) as number,
            confirmed: 0,
            pending: 0,
        }));
    }
    if (!loads.length && !added.length) {
        return empty(`${project.projectName} has no partners yet. Add a partner to place the units.`, 'partner_capacity');
    }

    // Capacity raises: only up, only for this project's partners.
    const raises = new Map<number, number>();
    for (const r of args.raises ?? []) {
        const id = Math.floor(n(r.idProjectPartners));
        const cap = Math.floor(n(r.capacity));
        const load = loads.find((l) => l.idProjectPartners === id);
        if (!load) return empty('A capacity change names a partner who is not on this project.', 'bad_raise');
        if (load.capacity === 0) continue; // no limit already
        if (cap < load.capacity) return empty(`${load.fullName}'s capacity can only be raised here (it is ${load.capacity}).`, 'bad_raise');
        if (cap > load.capacity) raises.set(id, cap);
    }
    const planned = [...loads.map((l) => ({ ...l, capacity: raises.get(l.idProjectPartners) ?? l.capacity })), ...added];
    const changesCapacity = raises.size > 0 || added.length > 0;

    // The project's total follows the partners' capacity (as on the project page).
    const confirmedSum = loads.reduce((s, l) => s + l.confirmed, 0);
    const from = n(project.totalAvailableUnits);
    let to = from;
    if (changesCapacity && !loads.some((l) => l.capacity === 0)) {
        const oldSum = loads.reduce((s, l) => s + l.capacity, 0);
        const newSum = planned.reduce((s, l) => s + l.capacity, 0);
        to = nextProjectTotal(from, oldSum, newSum, confirmedSum);
    }
    const confirmedInProject = n(
        await ProjectInvestor.sum('unitPurchased', {
            where: { idProjects: args.idProjects, investmentStatus: 'confirmed', idProjectInvestors: { [Op.ne]: leaving } },
            transaction,
        }),
    );
    const projectLeft = to > 0 ? Math.max(0, to - confirmedInProject) : null;

    const fit = fitAllocation(planned, units);
    const byId = new Map(fit.allocations.map((a) => [a.idProjectPartners, a.units]));
    const partners: AllocationPartner[] = planned.map((p, i) => ({
        idProjectPartners: p.idProjectPartners,
        fullName: p.fullName,
        capacity: i < loads.length ? loads[i].capacity : 0,
        plannedCapacity: p.capacity,
        confirmed: p.confirmed,
        pending: p.pending,
        left: unitsLeft(p),
        units: byId.get(p.idProjectPartners) ?? 0,
        ...(i >= loads.length ? { isNew: true, idUsers: p.idUsers } : {}),
    }));

    let problem: string | null = null;
    let code: AllocationPlan['code'] = null;
    if (fit.shortfall > 0) {
        problem = `The partners have room for ${units - fit.shortfall} of ${units} unit(s). Raise a partner's capacity or add a partner to place the other ${fit.shortfall}.`;
        code = 'partner_capacity';
    } else if (projectLeft !== null && units > projectLeft) {
        problem = `${project.projectName} has ${projectLeft} unit(s) left${changesCapacity ? ' even with the new capacity' : ''}. Add more partner capacity, or choose fewer units.`;
        code = 'project_total';
    } else {
        const cap = n(project.investorUnitCapacity);
        if (cap > 0) {
            const held = n(
                await ProjectInvestor.sum('unitPurchased', {
                    where: { idUsers: args.idUsers, idProjects: args.idProjects, investmentStatus: 'confirmed', idProjectInvestors: { [Op.ne]: leaving } },
                    transaction,
                }),
            );
            if (held + units > cap) {
                problem = `This investor holds ${held} unit(s) in ${project.projectName}; ${units} more would pass the limit of ${cap} per investor.`;
                code = 'investor_cap';
            }
        }
    }

    const plan: AllocationPlan = {
        partners,
        allocations: fit.allocations,
        shortfall: fit.shortfall,
        projectLeft,
        projectTotal: to !== from ? { from, to } : null,
        problem,
        code,
    };

    if (opts.apply && !problem) {
        for (const [idProjectPartners, capacity] of Array.from(raises.entries())) {
            await ProjectPartner.update({ partnerUnitCapacity: capacity } as any, { where: { idProjectPartners, idProjects: args.idProjects }, transaction });
        }
        // Assign the new partners, then give their units the real ids.
        const realId = new Map<number, number>();
        for (const a of added) {
            const row = (await ProjectPartner.create({ idProjects: args.idProjects, idUsers: a.idUsers, partnerUnitCapacity: a.capacity } as any, { transaction })) as any;
            realId.set(a.idProjectPartners, Number(row.idProjectPartners));
        }
        if (realId.size) {
            plan.allocations = plan.allocations.map((x) => ({ ...x, idProjectPartners: realId.get(x.idProjectPartners) ?? x.idProjectPartners }));
            plan.partners = plan.partners.map((x) => ({ ...x, idProjectPartners: realId.get(x.idProjectPartners) ?? x.idProjectPartners }));
        }
        if (to !== from) await Project.update({ totalAvailableUnits: to } as any, { where: { idProjects: args.idProjects }, transaction });
    }
    return plan;
}
