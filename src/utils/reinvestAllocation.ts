import { Op, type Transaction } from 'sequelize';
import { Project, ProjectInvestor, ProjectPartner, ProjectPartnerInvestor } from '@/models/__associations';
import { partnerLoads } from '@/utils/partnerCapacity';
import { fitAllocation, nextProjectTotal, unitsLeft, type PartnerLoad } from '@/utils/partnerCapacityShared';

/**
 * Where a reinvestment's units go: split round robin across the project's
 * partners (the same fitAllocation rule as an investor's booking in the app),
 * never one partner chosen by hand.
 *
 * An admin may raise partners' capacity in the same step when they do not
 * have room for all the units. The raises are checked here (only up, never
 * below what a partner already holds) and, with `apply`, saved in the
 * caller's transaction together with the project's unit total, which follows
 * the partners' capacity the same way as when capacity is edited on the
 * project (nextProjectTotal).
 *
 * The same function answers the dialog's live preview (apply: false) and the
 * save (apply: true), so what the admin sees is what is recorded.
 */

export type CapacityRaise = { idProjectPartners: number; capacity: number };

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
    if (!loads.length) return empty(`${project.projectName} has no partners yet. Add partners to the project first.`, 'no_partners');

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
    const planned = loads.map((l) => ({ ...l, capacity: raises.get(l.idProjectPartners) ?? l.capacity }));

    // The project's total follows the partners' capacity (as on the project page).
    const confirmedSum = loads.reduce((s, l) => s + l.confirmed, 0);
    const from = n(project.totalAvailableUnits);
    let to = from;
    if (raises.size && !loads.some((l) => l.capacity === 0)) {
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
        capacity: loads[i].capacity,
        plannedCapacity: p.capacity,
        confirmed: p.confirmed,
        pending: p.pending,
        left: unitsLeft(p),
        units: byId.get(p.idProjectPartners) ?? 0,
    }));

    let problem: string | null = null;
    let code: AllocationPlan['code'] = null;
    if (projectLeft !== null && units > projectLeft) {
        problem = `${project.projectName} has ${projectLeft} unit(s) left${raises.size ? ' even with the new capacity' : ''}. Raise partner capacity, or choose fewer units.`;
        code = 'project_total';
    } else if (fit.shortfall > 0) {
        problem = `The partners have room for ${units - fit.shortfall} of ${units} unit(s). Raise partner capacity to place the other ${fit.shortfall}.`;
        code = 'partner_capacity';
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
        if (to !== from) await Project.update({ totalAvailableUnits: to } as any, { where: { idProjects: args.idProjects }, transaction });
    }
    return plan;
}
