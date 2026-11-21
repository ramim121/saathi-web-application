/**
 * Partner capacity rules that both the browser and the server use.
 * Keep server-only imports out of this file: pages import it.
 *
 * Words used throughout:
 *   capacity   units a partner can hold on a project (0 = no limit)
 *   confirmed  units with payment confirmed: the hard limit counts these
 *   pending    units booked and awaiting payment: they reserve room, but an
 *              unpaid booking must not be able to block a paying investor
 */

export type PartnerLoad = {
    idProjectPartners: number;
    idProjects: number;
    idUsers: number;
    fullName: string;
    capacity: number;
    confirmed: number;
    pending: number;
};

export type Allocation = { idProjectPartners: number; units: number };

export type FitResult = {
    allocations: Allocation[];
    /** Units that could not stay where they were requested. */
    moved: number;
    /** Units no partner has room for. */
    shortfall: number;
};

/** Room left once pending bookings are counted; null means no limit. */
export function unitsLeft(p: Pick<PartnerLoad, 'capacity' | 'confirmed' | 'pending'>): number | null {
    return p.capacity > 0 ? Math.max(0, p.capacity - p.confirmed - p.pending) : null;
}

/**
 * Places `units` across a project's partners.
 *
 * What was requested stays where it is if it fits. Anything else goes round
 * robin: each unit to the partner holding the fewest units, first among those
 * with unreserved room, and only then into room held by unpaid bookings.
 *
 * `keepWithin` decides what "fits" means for the request itself: `reserved`
 * for an investor's booking, `confirmed` for an admin's explicit choice or a
 * payment being confirmed.
 */
export function fitAllocation(
    partners: PartnerLoad[],
    units: number,
    requested: Allocation[] = [],
    opts: { keepWithin?: 'reserved' | 'confirmed' } = {},
): FitResult {
    const state = partners.map((p) => ({ ...p, added: 0 }));
    const byId = new Map(state.map((s) => [s.idProjectPartners, s]));
    type Slot = (typeof state)[number];
    const roomReserved = (s: Slot) => (s.capacity > 0 ? s.capacity - s.confirmed - s.pending - s.added : Number.POSITIVE_INFINITY);
    const roomConfirmed = (s: Slot) => (s.capacity > 0 ? s.capacity - s.confirmed - s.added : Number.POSITIVE_INFINITY);
    const keepRoom = opts.keepWithin === 'confirmed' ? roomConfirmed : roomReserved;

    // A request that does not add up to the units is ignored, not half-used.
    const requestedTotal = requested.reduce((sum, r) => sum + r.units, 0);
    const useRequest = requested.length > 0 && requestedTotal === units;
    let left = units;
    if (useRequest) {
        for (const r of requested) {
            const slot = byId.get(r.idProjectPartners);
            if (!slot) continue;
            const keep = Math.min(r.units, Math.max(0, keepRoom(slot)));
            slot.added += keep;
            left -= keep;
        }
    }
    const moved = useRequest ? left : 0;

    const spread = (room: (s: Slot) => number) => {
        while (left > 0) {
            let next: Slot | null = null;
            for (const s of state) {
                if (room(s) <= 0) continue;
                if (!next) {
                    next = s;
                    continue;
                }
                const a = s.confirmed + s.pending + s.added;
                const b = next.confirmed + next.pending + next.added;
                if (a < b || (a === b && s.idProjectPartners < next.idProjectPartners)) next = s;
            }
            if (!next) return;
            next.added += 1;
            left -= 1;
        }
    };
    spread(roomReserved);
    spread(roomConfirmed);

    return {
        allocations: state.filter((s) => s.added > 0).map((s) => ({ idProjectPartners: s.idProjectPartners, units: s.added })),
        moved: Math.max(0, moved - left),
        shortfall: left,
    };
}

export const NEARING_PERCENT = 75;
export const CRITICAL_PERCENT = 90;

export type CapacityLevel = 'ok' | 'nearing' | 'critical' | 'full' | 'no_partners' | 'no_limit' | 'closed';

export type ProjectCapacity = {
    idProjects: number;
    projectName: string;
    projectStatus: string;
    location: string | null;
    duration: number;
    tenure: string;
    unitValue: number;
    /** The project's own unit total (0 = no total set). */
    totalUnits: number;
    partners: number;
    /** What the partners can hold; null when one of them has no limit. */
    partnerCapacity: number | null;
    confirmed: number;
    pending: number;
    /** The real ceiling: the smaller of the total and the partners' capacity. */
    limit: number | null;
    left: number | null;
    usedPercent: number;
    level: CapacityLevel;
    /** Units the project advertises that no partner can hold. */
    gap: number;
};

const CLOSED = ['closed', 'completed'];

export const isOpenProject = (status: string) => !CLOSED.includes(status);

export function summarizeCapacity(
    project: Pick<ProjectCapacity, 'idProjects' | 'projectName' | 'projectStatus' | 'location' | 'duration' | 'tenure' | 'unitValue' | 'totalUnits' | 'confirmed' | 'pending'>,
    loads: Pick<PartnerLoad, 'capacity'>[],
): ProjectCapacity {
    const partnerCapacity = loads.length === 0 ? 0 : loads.some((l) => l.capacity <= 0) ? null : loads.reduce((sum, l) => sum + l.capacity, 0);
    const headline = project.totalUnits > 0 ? project.totalUnits : null;
    const limit = headline === null ? partnerCapacity : partnerCapacity === null ? headline : Math.min(headline, partnerCapacity);
    const used = project.confirmed + project.pending;
    const left = limit === null ? null : Math.max(0, limit - used);
    const usedPercent = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;

    let level: CapacityLevel = 'ok';
    if (!isOpenProject(project.projectStatus)) level = 'closed';
    else if (loads.length === 0) level = 'no_partners';
    else if (limit === null) level = 'no_limit';
    else if (left === 0) level = 'full';
    else if (usedPercent >= CRITICAL_PERCENT) level = 'critical';
    else if (usedPercent >= NEARING_PERCENT) level = 'nearing';

    const gap = headline !== null && partnerCapacity !== null && headline > partnerCapacity ? headline - partnerCapacity : 0;
    return { ...project, partners: loads.length, partnerCapacity, limit, left, usedPercent, level, gap };
}

export const needsAttention = (c: Pick<ProjectCapacity, 'level'>) => ['nearing', 'critical', 'full', 'no_partners'].includes(c.level);

export const CAPACITY_FILTERS = [
    { value: 'attention', label: 'Needs attention' },
    { value: 'nearing', label: 'Nearing capacity' },
    { value: 'full', label: 'Full' },
    { value: 'no_partners', label: 'No partners' },
    { value: 'gap', label: 'Offers more than partners hold' },
];

export function matchesCapacityFilter(c: ProjectCapacity, filter: string): boolean {
    if (!isOpenProject(c.projectStatus)) return false;
    if (filter === 'attention') return needsAttention(c) || c.gap > 0;
    if (filter === 'nearing') return c.level === 'nearing' || c.level === 'critical';
    if (filter === 'full') return c.level === 'full';
    if (filter === 'no_partners') return c.level === 'no_partners';
    if (filter === 'gap') return c.gap > 0;
    return true;
}

export const CAPACITY_LABEL: Record<CapacityLevel, string> = {
    ok: 'Has room',
    nearing: 'Nearing capacity',
    critical: 'Almost full',
    full: 'Full',
    no_partners: 'No partners',
    no_limit: 'No limit',
    closed: 'Closed',
};

export const CAPACITY_TONE: Record<CapacityLevel, 'green' | 'amber' | 'rose' | 'slate' | 'sky'> = {
    ok: 'green',
    nearing: 'amber',
    critical: 'rose',
    full: 'rose',
    no_partners: 'rose',
    no_limit: 'sky',
    closed: 'slate',
};

/**
 * The project's unit total after its partners' capacity changes.
 *
 * It used to grow by every partner's capacity, on top of whatever was typed
 * when the project was created, so totals drifted to double what partners could
 * hold. Now it follows only when it would otherwise fall short, or when it was
 * exactly the partners' sum. A total set deliberately lower or higher stays.
 */
export function nextProjectTotal(total: number, oldCapacity: number, newCapacity: number, confirmed: number): number {
    // A new project starts with no total: its partners' capacity becomes it.
    if (total <= 0) return newCapacity > oldCapacity ? newCapacity : total;
    if (newCapacity > oldCapacity) return total >= oldCapacity && total < newCapacity ? newCapacity : total;
    if (newCapacity < oldCapacity && total === oldCapacity) return Math.max(newCapacity, confirmed) || total;
    return total;
}
