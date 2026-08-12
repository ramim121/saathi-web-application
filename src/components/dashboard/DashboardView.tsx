import React from 'react';
import Link from 'next/link';
import type { Dashboard, StatCard } from '@/utils/dashboard';

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
 * block says which statuses it includes.
 *
 * Built with the Bootstrap classes the rest of the admin already uses rather
 * than a new styling system, so it stays consistent with the pages around it.
 */

const TONE_CLASS: Record<StatCard['tone'], string> = {
    brand: 'border-primary text-primary',
    good: 'border-success text-success',
    warn: 'border-warning text-warning',
    alert: 'border-danger text-danger',
    info: 'border-info text-info',
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

function StatTile({ card }: { card: StatCard }) {
    return (
        <div className="col-12 col-sm-6 col-xl mb-3">
            <div className={`card h-100 border-start border-4 ${TONE_CLASS[card.tone]}`}>
                <div className="card-body py-3">
                    <div className="text-muted text-uppercase fw-semibold" style={{ fontSize: '0.7rem', letterSpacing: '0.04em' }}>
                        {card.label}
                    </div>
                    <div className={`fw-bold ${TONE_CLASS[card.tone]}`} style={{ fontSize: '1.35rem' }}>
                        {card.money ? money(card.value) : card.value.toLocaleString('en-IN')}
                    </div>
                    <div className="text-muted" style={{ fontSize: '0.78rem' }}>
                        {card.note}
                    </div>
                </div>
            </div>
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
            <div className="progress-bar bg-primary" style={{ width: `${percent}%` }} />
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
    return (
        <div className="card h-100">
            <div className="card-header bg-white d-flex justify-content-between align-items-start gap-2 py-3">
                <div>
                    <h2 className="h6 mb-0 fw-bold">{title}</h2>
                    {subtitle && (
                        <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                            {subtitle}
                        </div>
                    )}
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

export function DashboardView({ data }: { data: Dashboard }) {
    const maxProject = Math.max(0, ...data.byProject.map((r) => r.totalRaised));
    const maxMonth = Math.max(0, ...data.byMonth.map((r) => r.totalRaised));
    const maxPartner = Math.max(0, ...data.topPartners.map((r) => r.totalManaged));
    const maxType = Math.max(0, ...data.byType.map((r) => r.totalRaised));

    return (
        <>
            <div className="d-flex flex-wrap justify-content-between align-items-end gap-2 mb-3">
                <div>
                    <h1 className="h4 fw-bold mb-1">Management dashboard</h1>
                    <p className="text-muted mb-0" style={{ fontSize: '0.82rem' }}>
                        Amounts are units × unit value. Cancelled positions are excluded throughout.
                    </p>
                </div>
                <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                    Generated {new Date(data.generatedAt).toLocaleString('en-GB')}
                </div>
            </div>

            <div className="row g-0 gx-3">
                {data.cards.map((card) => (
                    <StatTile key={card.label} card={card} />
                ))}
            </div>

            <div className="row g-3 mt-0">
                <div className="col-12 col-xl-7">
                    <Panel
                        title="Payables forecast"
                        subtitle="Positions maturing ahead. Anything already overdue is on the card above."
                    >
                        {data.payables.every((p) => p.count === 0) ? (
                            <Empty>Nothing matures in the next three months.</Empty>
                        ) : (
                            <div className="table-responsive">
                                <table className="table table-sm mb-0 align-middle">
                                    <thead className="table-light">
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
                                                <td className="text-end fw-semibold">{money(row.profitAndCapital)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        <p className="text-muted small mb-0 px-3 py-2 border-top">
                            Profit uses each project&apos;s <strong>minimum</strong> return. Windows are
                            cumulative, so the 3-month row includes the 15-day one.
                        </p>
                    </Panel>
                </div>

                <div className="col-12 col-xl-5">
                    <Panel title="Monthly trend" subtitle="Last six months, by payment date">
                        {data.byMonth.length === 0 ? (
                            <Empty>No investments recorded in the last six months.</Empty>
                        ) : (
                            <div className="table-responsive">
                                <table className="table table-sm mb-0 align-middle">
                                    <thead className="table-light">
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
                </div>

                <div className="col-12 col-xl-7">
                    <Panel
                        title="Investment by project"
                        action={{ href: '/projects/list', label: 'All projects' }}
                    >
                        {data.byProject.length === 0 ? (
                            <Empty>No investments recorded yet.</Empty>
                        ) : (
                            <div className="table-responsive">
                                <table className="table table-sm mb-0 align-middle">
                                    <thead className="table-light">
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
                                                    <span className="badge bg-light text-dark fw-normal">
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
                </div>

                <div className="col-12 col-xl-5">
                    <div className="d-flex flex-column gap-3 h-100">
                        <Panel title="By investment type">
                            {data.byType.length === 0 ? (
                                <Empty>No investments recorded yet.</Empty>
                            ) : (
                                <div className="table-responsive">
                                    <table className="table table-sm mb-0 align-middle">
                                        <thead className="table-light">
                                            <tr>
                                                <th>Type</th>
                                                <th className="text-end">Investors</th>
                                                <th className="text-end">Raised</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {data.byType.map((row) => (
                                                <tr key={row.investmentType}>
                                                    <td className="fw-semibold">{prettyType(row.investmentType)}</td>
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
                                An investor in both types is counted in both rows, so these do not sum
                                to the investor count above.
                            </p>
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
                                    <table className="table table-sm mb-0 align-middle">
                                        <thead className="table-light">
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
            </div>
        </>
    );
}
