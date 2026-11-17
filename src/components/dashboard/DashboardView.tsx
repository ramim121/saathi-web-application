import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Banknote, CalendarClock, Clock3, Hourglass, TrendingUp, Users, Wallet, type LucideIcon } from 'lucide-react';
import type { Dashboard, StatCard, Drill } from '@/utils/dashboard';
import type { DashboardDetail } from '@/utils/dashboardDetail';
import { DrillSet } from './DrillSets';
import { bdt } from '@/ui/format';
import { dhakaStamp } from '@/ui/status';
import { cx } from '@/ui/primitives';
import { PageHeader } from '@/ui/layout';

/**
 * The management dashboard. Redesigned 2026-11-17 (Tailwind); the figures,
 * their sources and the drill-downs are unchanged.
 *
 * WHAT IT IS FOR
 * Three questions, in the order an operator asks them: how much money is
 * working, what has to go out and when, and where it came from. Everything else
 * is a link to the section that owns it.
 *
 * NUMBERS ARE STATED WITH THEIR BASIS
 * Every figure here is derived — units times unit value. A dashboard that shows
 * a total without saying what it counts invites someone to reconcile it against
 * a list that counts something else, so each block says which statuses it
 * includes, and every tile opens the exact rows its figure counts.
 *
 * The "generated" time is formatted in Asia/Dhaka from parts: formatting it in
 * the viewer's timezone made the server and the browser disagree and broke
 * hydration for every admin in Bangladesh.
 */

const TONE: Record<StatCard['tone'], { chip: string; value: string; ring: string }> = {
    brand: { chip: 'tw-bg-brand-50 tw-text-brand-700', value: 'tw-text-brand-800', ring: 'hover:tw-ring-brand-600/25' },
    good: { chip: 'tw-bg-emerald-50 tw-text-emerald-700', value: 'tw-text-emerald-700', ring: 'hover:tw-ring-emerald-600/25' },
    warn: { chip: 'tw-bg-amber-50 tw-text-amber-700', value: 'tw-text-amber-700', ring: 'hover:tw-ring-amber-600/25' },
    alert: { chip: 'tw-bg-rose-50 tw-text-rose-700', value: 'tw-text-rose-700', ring: 'hover:tw-ring-rose-600/25' },
    info: { chip: 'tw-bg-sky-50 tw-text-sky-700', value: 'tw-text-sky-700', ring: 'hover:tw-ring-sky-600/25' },
};

/** An icon for each tile, chosen by what its label talks about. */
function iconFor(label: string): LucideIcon {
    const l = label.toLowerCase();
    if (l.includes('overdue') || l.includes('matured') || l.includes('payout')) return Hourglass;
    if (l.includes('pending') || l.includes('await') || l.includes('proof')) return Clock3;
    if (l.includes('investor')) return Users;
    if (l.includes('matur') || l.includes('due')) return CalendarClock;
    if (l.includes('raised') || l.includes('total')) return TrendingUp;
    if (l.includes('active') || l.includes('working') || l.includes('capital')) return Wallet;
    return Banknote;
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
    // A tile with a breakdown is a real button (keyboard and screen readers get
    // it for free); one without stays inert instead of looking clickable.
    const drill = card.drill;
    const tone = TONE[card.tone];
    const Icon = iconFor(card.label);
    const body = (
        <>
            <div className="tw-flex tw-items-center tw-gap-2 tw-text-[13px] tw-font-medium tw-text-slate-500">
                <span className={cx('tw-inline-flex tw-h-6 tw-w-6 tw-items-center tw-justify-center tw-rounded-lg', tone.chip)}>
                    <Icon className="tw-h-3.5 tw-w-3.5" aria-hidden />
                </span>
                <span className="tw-truncate">{card.label}</span>
            </div>
            <div className={cx('tw-mt-2.5 tw-text-[22px] tw-font-semibold tw-leading-7 tw-tracking-tight tw-tabular-nums', tone.value)}>
                {card.money ? bdt(card.value) : card.value.toLocaleString('en-IN')}
            </div>
            <div className="tw-mt-1 tw-text-xs tw-leading-relaxed tw-text-slate-500">{card.note}</div>
            {drill && (
                <span className="tw-mt-2 tw-inline-flex tw-items-center tw-gap-1 tw-text-xs tw-font-semibold tw-text-brand-700 tw-opacity-0 tw-transition group-hover:tw-opacity-100 group-focus-visible:tw-opacity-100 [@media(hover:none)]:tw-opacity-100">
                    View breakdown <ArrowRight className="tw-h-3 tw-w-3" aria-hidden />
                </span>
            )}
        </>
    );
    const base = 'tw-h-full tw-w-full tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 tw-text-left tw-shadow-card';
    return drill ? (
        <button
            type="button"
            onClick={() => onOpen(drill)}
            aria-label={`${card.label} — view breakdown`}
            className={cx(
                base,
                'tw-group tw-ring-1 tw-ring-transparent tw-transition hover:-tw-translate-y-px hover:tw-shadow-pop focus-visible:tw-outline-none focus-visible:tw-ring-2 focus-visible:tw-ring-brand-500',
                tone.ring,
            )}
        >
            {body}
        </button>
    ) : (
        <div className={base}>{body}</div>
    );
}

/** A thin bar sized against the largest row — the distribution at a glance. */
function Bar({ value, max }: { value: number; max: number }) {
    const percent = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
    return (
        <span className="tw-mt-1.5 tw-block tw-h-1 tw-w-full tw-overflow-hidden tw-rounded-full tw-bg-slate-100" role="presentation">
            <span className="tw-block tw-h-full tw-rounded-full tw-bg-brand-600" style={{ width: `${percent}%` }} />
        </span>
    );
}

function Panel({
    title,
    subtitle,
    action,
    footnote,
    children,
}: {
    title: string;
    subtitle?: string;
    action?: { href: string; label: string };
    footnote?: React.ReactNode;
    children: React.ReactNode;
}) {
    // Panels size to their content; each column stacks its own panels, so a
    // short one never has to match a tall neighbour.
    return (
        <section className="tw-overflow-hidden tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-shadow-card">
            <div className="tw-flex tw-items-start tw-justify-between tw-gap-3 tw-px-5 tw-pb-3 tw-pt-4">
                <div className="tw-min-w-0">
                    <h2 className="tw-text-sm tw-font-semibold tw-text-slate-900">{title}</h2>
                    {subtitle && <p className="tw-mt-0.5 tw-text-xs tw-text-slate-500">{subtitle}</p>}
                </div>
                {action && (
                    <Link
                        href={action.href}
                        className="tw-inline-flex tw-shrink-0 tw-items-center tw-gap-1 tw-rounded-lg tw-px-2 tw-py-1 tw-text-xs tw-font-semibold tw-text-brand-700 hover:tw-bg-brand-50"
                    >
                        {action.label}
                        <ArrowUpRight className="tw-h-3.5 tw-w-3.5" aria-hidden />
                    </Link>
                )}
            </div>
            {children}
            {footnote && <p className="tw-border-t tw-border-slate-100 tw-px-5 tw-py-2.5 tw-text-xs tw-text-slate-500">{footnote}</p>}
        </section>
    );
}

const th = 'tw-whitespace-nowrap tw-bg-slate-50/80 tw-px-5 tw-py-2 tw-text-left tw-text-[11px] tw-font-semibold tw-uppercase tw-tracking-wider tw-text-slate-500';
const thR = `${th} tw-text-right`;
const td = 'tw-px-5 tw-py-2.5';
const tdR = `${td} tw-text-right tw-tabular-nums`;
const tr = 'tw-border-t tw-border-slate-100 hover:tw-bg-slate-50/60';

function Empty({ children }: { children: React.ReactNode }) {
    return <p className="tw-px-5 tw-pb-5 tw-text-sm tw-text-slate-500">{children}</p>;
}

export function DashboardView({ data, detail }: { data: Dashboard; detail: DashboardDetail }) {
    const [drill, setDrill] = useState<Drill | null>(null);

    const maxProject = Math.max(0, ...data.byProject.map((r) => r.totalRaised));
    const maxMonth = Math.max(0, ...data.byMonth.map((r) => r.totalRaised));
    const maxPartner = Math.max(0, ...data.topPartners.map((r) => r.totalManaged));
    const maxType = Math.max(0, ...data.byType.map((r) => r.totalRaised));

    return (
        <>
            <PageHeader
                eyebrow="Overview"
                title="Dashboard"
                description="Amounts are units × unit value. Cancelled positions are excluded throughout. Every figure opens the rows it counts."
                actions={
                    <span className="tw-inline-flex tw-items-center tw-gap-1.5 tw-rounded-lg tw-bg-white tw-px-2.5 tw-py-1.5 tw-text-xs tw-text-slate-500 tw-ring-1 tw-ring-slate-200">
                        <Clock3 className="tw-h-3.5 tw-w-3.5" aria-hidden />
                        Generated {dhakaStamp(data.generatedAt)}
                    </span>
                }
            />

            <div className="tw-grid tw-grid-cols-1 tw-gap-3 sm:tw-grid-cols-2 xl:tw-grid-cols-5">
                {data.cards.map((card) => (
                    <StatTile key={card.label} card={card} onOpen={setDrill} />
                ))}
            </div>

            <div className="tw-mt-6 tw-grid tw-grid-cols-1 tw-items-start tw-gap-6 xl:tw-grid-cols-12">
                <div className="tw-flex tw-flex-col tw-gap-6 xl:tw-col-span-7">
                    <Panel
                        title="Payables forecast"
                        subtitle="Positions maturing ahead. Anything already overdue is on the card above."
                        footnote={
                            data.payables.some((p) => p.count > 0) ? (
                                <>
                                    Profit uses each project&apos;s <strong>minimum</strong> return. Windows are cumulative, so the 3-month row includes the
                                    15-day one.
                                </>
                            ) : undefined
                        }
                    >
                        {data.payables.every((p) => p.count === 0) ? (
                            <Empty>
                                Nothing matures in the next three months. Positions already past maturity are on the <strong>Matured, awaiting payout</strong> card.
                            </Empty>
                        ) : (
                            <div className="tw-overflow-x-auto">
                                <table className="tw-w-full tw-text-sm">
                                    <thead>
                                        <tr>
                                            <th className={th}>Window</th>
                                            <th className={thR}>Positions</th>
                                            <th className={thR}>Profit only</th>
                                            <th className={thR}>Profit + capital</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.payables.map((row) => (
                                            <tr key={row.label} className={tr}>
                                                <td className={cx(td, 'tw-font-medium tw-text-slate-800')}>{row.label}</td>
                                                <td className={tdR}>{row.count}</td>
                                                <td className={tdR}>{bdt(row.profitOnly)}</td>
                                                <td className={cx(tdR, 'tw-font-semibold tw-text-slate-900')}>{bdt(row.profitAndCapital)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Panel>

                    <Panel title="Investment by project" action={{ href: '/projects/list', label: 'All projects' }}>
                        {data.byProject.length === 0 ? (
                            <Empty>No investments recorded yet.</Empty>
                        ) : (
                            <div className="tw-overflow-x-auto">
                                <table className="tw-w-full tw-text-sm">
                                    <thead>
                                        <tr>
                                            <th className={th}>Project</th>
                                            <th className={th}>Type</th>
                                            <th className={thR}>Investors</th>
                                            <th className={thR}>Units</th>
                                            <th className={thR}>Raised</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.byProject.map((row) => (
                                            <tr key={row.idProjects} className={tr}>
                                                <td className={cx(td, 'tw-font-medium tw-text-slate-800')}>{row.projectName}</td>
                                                <td className={td}>
                                                    <span className="tw-inline-flex tw-rounded-md tw-bg-slate-100 tw-px-1.5 tw-py-0.5 tw-text-xs tw-text-slate-600">
                                                        {prettyType(row.investmentType)}
                                                    </span>
                                                </td>
                                                <td className={tdR}>{row.investors}</td>
                                                <td className={tdR}>{row.units}</td>
                                                <td className={cx(tdR, 'tw-min-w-[9rem]')}>
                                                    {bdt(row.totalRaised)}
                                                    <Bar value={row.totalRaised} max={maxProject} />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Panel>

                    <Panel
                        title="By investment type"
                        footnote="An investor in both types is counted in both rows, so these do not sum to the investor count above."
                    >
                        {data.byType.length === 0 ? (
                            <Empty>No investments recorded yet.</Empty>
                        ) : (
                            <div className="tw-overflow-x-auto">
                                <table className="tw-w-full tw-text-sm">
                                    <thead>
                                        <tr>
                                            <th className={th}>Type</th>
                                            <th className={thR}>Investors</th>
                                            <th className={thR}>Raised</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.byType.map((row) => (
                                            <tr key={row.investmentType} className={tr}>
                                                <td className={cx(td, 'tw-font-medium tw-text-slate-800')}>{prettyType(row.investmentType)}</td>
                                                <td className={tdR}>{row.investors}</td>
                                                <td className={cx(tdR, 'tw-min-w-[9rem]')}>
                                                    {bdt(row.totalRaised)}
                                                    <Bar value={row.totalRaised} max={maxType} />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Panel>
                </div>

                <div className="tw-flex tw-flex-col tw-gap-6 xl:tw-col-span-5">
                    <Panel title="Monthly trend" subtitle="Last six months, by payment date">
                        {data.byMonth.length === 0 ? (
                            <Empty>No investments recorded in the last six months.</Empty>
                        ) : (
                            <div className="tw-overflow-x-auto">
                                <table className="tw-w-full tw-text-sm">
                                    <thead>
                                        <tr>
                                            <th className={th}>Month</th>
                                            <th className={thR}>Positions</th>
                                            <th className={thR}>Raised</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.byMonth.map((row) => (
                                            <tr key={row.month} className={tr}>
                                                <td className={cx(td, 'tw-font-medium tw-text-slate-800')}>{row.month}</td>
                                                <td className={tdR}>{row.investments}</td>
                                                <td className={cx(tdR, 'tw-min-w-[9rem]')}>
                                                    {bdt(row.totalRaised)}
                                                    <Bar value={row.totalRaised} max={maxMonth} />
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Panel>

                    <Panel title="Top partners" subtitle="By capital managed" action={{ href: '/partners/list', label: 'All partners' }}>
                        {data.topPartners.length === 0 ? (
                            <Empty>No partner allocations recorded yet.</Empty>
                        ) : (
                            <div className="tw-overflow-x-auto">
                                <table className="tw-w-full tw-text-sm">
                                    <thead>
                                        <tr>
                                            <th className={cx(th, 'tw-w-10')}>#</th>
                                            <th className={th}>Partner</th>
                                            <th className={thR}>Positions</th>
                                            <th className={thR}>Managed</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.topPartners.map((row, index) => (
                                            <tr key={`${row.name}-${index}`} className={tr}>
                                                <td className={cx(td, 'tw-tabular-nums tw-text-slate-400')}>{index + 1}</td>
                                                <td className={cx(td, 'tw-font-medium tw-text-slate-800')}>{row.name}</td>
                                                <td className={tdR}>{row.investments}</td>
                                                <td className={cx(tdR, 'tw-min-w-[9rem]')}>
                                                    {bdt(row.totalManaged)}
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
