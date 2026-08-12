import React, { useState } from 'react';
import Link from 'next/link';
import type { Dashboard, StatCard, Drill } from '@/utils/dashboard';
import type { DashboardDetail } from '@/utils/dashboardDetail';
import { DrillSet } from './DrillSets';

/**
 * The management dashboard.
 *
 * WHAT IT IS FOR
 * Three questions, in the order an operator asks them: how much money is
 * working, what has to go out and when, and where it came from. Everything else
 * is a link to the section that owns it.
 *
 * NUMBERS ARE STATED WITH THEIR BASIS
 * Every figure here is derived — units times unit value — because no amount is
 * stored. A dashboard that shows a total without saying what it counts invites
 * someone to reconcile it against a list that counts something else, so each
 * block says which statuses it includes, and every tile opens the exact rows
 * its figure counts.
 *
 * Built with the Bootstrap classes the rest of the admin already uses, restyled
 * globally by styles/admin-theme.css rather than page by page.
 */

/*
 * Tone drives both the tile's accent edge and the figure's colour, so it is one
 * class defined in admin-theme.css rather than a pair of Bootstrap utilities —
 * `border-primary` would repaint all four sides, not just the accent edge.
 */
const TONE_CLASS: Record<StatCard['tone'], string> = {
    brand: 'tone-brand',
    good: 'tone-good',
    warn: 'tone-warn',
    alert: 'tone-alert',
    info: 'tone-info',
};

function money(value: number): string {
    return `BDT ${value.toLocaleString('en-IN')}`;
}

/** Compact label for a raw enum value from the database. */
function prettyType(value: string | null): string {
    if (!value) return '—';
    return value
        .split('_')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
}

function StatTile({ card, onOpen }: { card: StatCard; onOpen: (d: Drill) => void }) {
    /*
     * A tile with a breakdown is a button, not a div with a click handler —
     * keyboard users reach it by tab and fire it with Enter for free, and a
     * screen reader announces it as activatable. Tiles without a breakdown stay
     * inert rather than looking clickable and doing nothing.
     *
     * `h-100` is right here and wrong on the panels below: these five are peers
     * in a single row, and a ragged row of KPI tiles reads as a mistake.
     */
    const drill = card.drill;
    const body = (
        <div className="card-body py-3">
            <div className="stat-label">{card.label}</div>
            <div className={`stat-value ${TONE_CLASS[card.tone]}`}>
                {card.money ? money(card.value) : card.value.toLocaleString('en-IN')}
            </div>
            <div className="stat-note">{card.note}</div>
            {drill && <span className="stat-more">View breakdown →</span>}
        </div>
    );

    return (
        <div className="col-12 col-sm-6 col-xl mb-3">
            {drill ? (
                <button
                    type="button"
                    className={`card stat-card stat-clickable h-100 w-100 text-start ${TONE_CLASS[card.tone]}`}
                    onClick={() => onOpen(drill)}
                    aria-label={`${card.label} — view breakdown`}
                >
                    {body}
                </button>
            ) : (
                <div className={`card stat-card h-100 ${TONE_CLASS[card.tone]}`}>{body}</div>
            )}
        </div>
    );
}

/**
 * A bar sized against the largest row.
 *
 * A table of amounts is read one line at a time; a bar behind the number makes
 * the distribution visible without a charting library, and degrades to a plain
 * table if styles fail to load.
 */
function Bar({ value, max }: { value: number; max: number }) {
    const percent = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
    return (
        <div className="progress mt-1" style={{ height: 4 }} role="presentation">
            <div className="progress-bar" style={{ width: `${percent}%` }} />
        </div>
    );
}

function Panel({
    title,
    subtitle,
    action,
    children,
}: {
    title: string;
    subtitle?: string;
    action?: { href: string; label: string };
    children: React.ReactNode;
}) {
    /*
     * No `h-100`. Panels size to their content; the columns they sit in do the
     * stacking, so a short panel never has to match a tall neighbour.
     */
    return (
        <div className="card">
            <div className="card-header d-flex justify-content-between align-items-start gap-2">
                <div>
                    <h2 className="h6 mb-0 fw-bold">{title}</h2>
                    {subtitle && <div className="text-muted small">{subtitle}</div>}
                </div>
                {action && (
                    <Link href={action.href} className="btn btn-sm btn-outline-secondary flex-shrink-0">
                        {action.label}
                    </Link>
                )}
            </div>
            <div className="card-body p-0">{children}</div>
        </div>
    );
}

function Empty({ children }: { children: React.ReactNode }) {
    return <p className="text-muted small mb-0 p-3">{children}</p>;
}

export function DashboardView({ data, detail }: { data: Dashboard; detail: DashboardDetail }) {
    const [drill, setDrill] = useState<Drill | null>(null);

    const maxProject = Math.max(0, ...data.byProject.map((r) => r.totalRaised));
    const maxMonth = Math.max(0, ...data.byMonth.map((r) => r.totalRaised));
    const maxPartner = Math.max(0, ...data.topPartners.map((r) => r.totalManaged));
    const maxType = Math.max(0, ...data.byType.map((r) => r.totalRaised));

    return (
        <>
            <div className="page-head">
                <div>
                    <h1 className="page-title">Management dashboard</h1>
                    <p className="page-subtitle">
                        Amounts are units × unit value. Cancelled positions are excluded throughout.
                        Every figure below opens the rows it counts.
                    </p>
                </div>
                <div className="text-muted small">
                    Generated {new Date(data.generatedAt).toLocaleString('en-GB')}
                </div>
            </div>

            <div className="row g-0 gx-3">
                {data.cards.map((card) => (
                    <StatTile key={card.label} card={card} onOpen={setDrill} />
                ))}
            </div>

            {/*
             * Two flowing columns, not a grid of rows.
             *
             * Bootstrap rows align their columns to a shared top edge, so a
             * short panel beside a tall one leaves the height difference as
             * blank page — the payables forecast (four lines) sat beside the
             * project table (ten rows) and left a hole the size of the table.
             * Stacking within each column lets every panel take its own height.
             */}
            <div className="row g-3 mt-0 align-items-start">
                <div className="col-12 col-xl-7 d-flex flex-column gap-3">
                    <Panel
                        title="Payables forecast"
                        subtitle="Positions maturing ahead. Anything already overdue is on the card above."
                    >
                        {data.payables.every((p) => p.count === 0) ? (
                            <Empty>
                                Nothing matures in the next three months. Positions already past
                                maturity are on the <strong>Matured, awaiting payout</strong> card.
                            </Empty>
                        ) : (
                            <div className="table-responsive">
                                <table className="table table-sm align-middle">
                                    <thead>
                                        <tr>
                                            <th>Window</th>
                                            <th className="text-end">Positions</th>
                                            <th className="text-end">Profit only</th>
                                            <th className="text-end">Profit + capital</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.payables.map((row) => (
                                            <tr key={row.label}>
                                                <td className="fw-semibold">{row.label}</td>
                                                <td className="text-end">{row.count}</td>
                                                <td className="text-end">{money(row.profitOnly)}</td>
                                                <td className="text-end fw-semibold">
                                                    {money(row.profitAndCapital)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        {data.payables.some((p) => p.count > 0) && (
                            <p className="text-muted small mb-0 px-3 py-2 border-top">
                                Profit uses each project&apos;s <strong>minimum</strong> return.
                                Windows are cumulative, so the 3-month row includes the 15-day one.
                            </p>
                        )}
                    </Panel>

                    <Panel
                        title="Investment by project"
                        action={{ href: '/projects/list', label: 'All projects' }}
                    >
                        {data.byProject.length === 0 ? (
                            <Empty>No investments recorded yet.</Empty>
                        ) : (
                            <div className="table-responsive">
                                <table className="table table-sm table-hover align-middle">
                                    <thead>
                                        <tr>
                                            <th>Project</th>
                                            <th>Type</th>
                                            <th className="text-end">Investors</th>
                                            <th className="text-end">Units</th>
                                            <th className="text-end">Raised</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.byProject.map((row) => (
                                            <tr key={row.idProjects}>
                                                <td className="fw-semibold">{row.projectName}</td>
                                                <td>
                                                    <span className="badge bg-body-secondary text-body-secondary fw-normal">
                                                        {prettyType(row.investmentType)}
                                                    </span>
                                                </td>
                                                <td className="text-end">{row.investors}</td>
                                                <td className="text-end">{row.units}</td>
                                                <td className="text-end">
                                                    {money(row.totalRaised)}
                                                    <Bar value={row.totalRaised} max={maxProject} />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Panel>
                    <Panel title="By investment type">
                        {data.byType.length === 0 ? (
                            <Empty>No investments recorded yet.</Empty>
                        ) : (
                            <div className="table-responsive">
                                <table className="table table-sm table-hover align-middle">
                                    <thead>
                                        <tr>
                                            <th>Type</th>
                                            <th className="text-end">Investors</th>
                                            <th className="text-end">Raised</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.byType.map((row) => (
                                            <tr key={row.investmentType}>
                                                <td className="fw-semibold">
                                                    {prettyType(row.investmentType)}
                                                </td>
                                                <td className="text-end">{row.investors}</td>
                                                <td className="text-end">
                                                    {money(row.totalRaised)}
                                                    <Bar value={row.totalRaised} max={maxType} />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        <p className="text-muted small mb-0 px-3 py-2 border-top">
                            An investor in both types is counted in both rows, so these do not sum to
                            the investor count above.
                        </p>
                    </Panel>

                </div>

                <div className="col-12 col-xl-5 d-flex flex-column gap-3">
                    <Panel title="Monthly trend" subtitle="Last six months, by payment date">
                        {data.byMonth.length === 0 ? (
                            <Empty>No investments recorded in the last six months.</Empty>
                        ) : (
                            <div className="table-responsive">
                                <table className="table table-sm table-hover align-middle">
                                    <thead>
                                        <tr>
                                            <th>Month</th>
                                            <th className="text-end">Positions</th>
                                            <th className="text-end">Raised</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.byMonth.map((row) => (
                                            <tr key={row.month}>
                                                <td className="fw-semibold">{row.month}</td>
                                                <td className="text-end">{row.investments}</td>
                                                <td className="text-end">
                                                    {money(row.totalRaised)}
                                                    <Bar value={row.totalRaised} max={maxMonth} />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Panel>

                    <Panel
                        title="Top partners"
                        subtitle="By capital managed"
                        action={{ href: '/partners/list', label: 'All partners' }}
                    >
                        {data.topPartners.length === 0 ? (
                            <Empty>No partner allocations recorded yet.</Empty>
                        ) : (
                            <div className="table-responsive">
                                <table className="table table-sm table-hover align-middle">
                                    <thead>
                                        <tr>
                                            <th style={{ width: '2.5rem' }}>#</th>
                                            <th>Partner</th>
                                            <th className="text-end">Positions</th>
                                            <th className="text-end">Managed</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.topPartners.map((row, index) => (
                                            <tr key={`${row.name}-${index}`}>
                                                <td className="text-muted">{index + 1}</td>
                                                <td className="fw-semibold">{row.name}</td>
                                                <td className="text-end">{row.investments}</td>
                                                <td className="text-end">
                                                    {money(row.totalManaged)}
                                                    <Bar value={row.totalManaged} max={maxPartner} />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Panel>
                </div>
            </div>

            <DrillSet which={drill} detail={detail} onClose={() => setDrill(null)} />
        </>
    );
}
