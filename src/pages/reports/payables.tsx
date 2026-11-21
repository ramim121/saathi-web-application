import React, { useMemo } from 'react';
import Link from 'next/link';
import type { GetServerSidePropsContext } from 'next';
import { AlertTriangle, CalendarClock, Download, Hourglass, Wallet, type LucideIcon } from 'lucide-react';
import MainLayout from '@/layouts/MainLayout';
import { requireAdminPage, redirectToLogin } from '@/utils/pageAuth';
import { loadPayables } from '@/utils/payables';
import { PAYABLE_WINDOWS, summarizeWindows, type PayableRow, type PayablesReport, type PayableWindowKey, type PayableWindowSummary } from '@/utils/payablesShared';
import { Card, Pill, Segmented, cx } from '@/ui/primitives';
import { Button, Field, Select } from '@/ui/controls';
import { PageHeader, TableCard, EmptyRow, TD, TH, TR } from '@/ui/layout';
import { ListFooter, ListToolbar, SortTH, filterChips, useClientRows, useListState } from '@/ui/table';
import { bdt, date, plural } from '@/ui/format';
import { downloadCsv } from '@/ui/csv';

/**
 * The payables forecast in full: what falls due, when, to whom and from which
 * booking. The dashboard shows the same windows in summary.
 */

type View = 'date' | 'investor' | 'project' | 'all';

const DEFAULTS = {
    q: '',
    window: '',
    project: '',
    view: 'date',
    orderBy: 'dueDate',
    orderType: 'ASC' as 'ASC' | 'DESC',
    page: 1,
    pageSize: 50,
};

const range = (min: number, max: number) => (Math.abs(min - max) < 0.5 ? bdt(min) : `${bdt(min)} – ${bdt(max)}`);

function dueLabel(row: PayableRow) {
    if (row.daysLeft === 0) return 'Due today';
    if (row.daysLeft < 0) return `${plural(-row.daysLeft, 'day')} past due`;
    return `in ${plural(row.daysLeft, 'day')}`;
}

const WINDOW_TONE: Record<PayableWindowKey, string> = {
    ready: 'tw-text-violet-700',
    overdue: 'tw-text-rose-700',
    d15: 'tw-text-amber-700',
    d30: 'tw-text-amber-700',
    d60: 'tw-text-slate-900',
    d90: 'tw-text-slate-900',
    later: 'tw-text-slate-900',
};

function Stat({ icon: Icon, label, min, max, note, tone }: { icon: LucideIcon; label: string; min: number; max: number; note: string; tone: string }) {
    return (
        <Card className="tw-p-4">
            <div className="tw-flex tw-items-center tw-gap-2 tw-text-[13px] tw-font-medium tw-text-slate-500">
                <span className={cx('tw-inline-flex tw-h-6 tw-w-6 tw-items-center tw-justify-center tw-rounded-lg', tone)}>
                    <Icon className="tw-h-3.5 tw-w-3.5" aria-hidden />
                </span>
                {label}
            </div>
            <div className="tw-mt-2.5 tw-text-[22px] tw-font-semibold tw-leading-7 tw-tracking-tight tw-tabular-nums tw-text-slate-900">{bdt(min)}</div>
            <div className="tw-mt-1 tw-text-xs tw-text-slate-500">
                {Math.abs(max - min) >= 0.5 ? `up to ${bdt(max)} · ` : ''}
                {note}
            </div>
        </Card>
    );
}

function addUp(windows: PayableWindowSummary[], keys: PayableWindowKey[]) {
    const rows = windows.filter((w) => keys.includes(w.key));
    return {
        min: rows.reduce((s, w) => s + w.minTotal, 0),
        max: rows.reduce((s, w) => s + w.maxTotal, 0),
        count: rows.reduce((s, w) => s + w.count, 0),
    };
}

function Row({ row, hideDue, hideInvestor, hideProject }: { row: PayableRow; hideDue?: boolean; hideInvestor?: boolean; hideProject?: boolean }) {
    return (
        <tr className={TR}>
            {!hideDue && (
                <td className={cx(TD, 'tw-whitespace-nowrap')}>
                    <div className="tw-font-medium tw-tabular-nums tw-text-slate-900">{date(row.dueDate)}</div>
                    <div className={cx('tw-text-xs', row.daysLeft < 0 ? 'tw-text-rose-600' : 'tw-text-slate-500')}>{dueLabel(row)}</div>
                </td>
            )}
            <td className={cx(TD, 'tw-whitespace-nowrap')}>
                {row.idBooking ? (
                    <Link href={`/bookings/details/${row.idBooking}`} className="tw-font-semibold tw-tabular-nums tw-text-brand-700 hover:tw-underline">
                        #{row.bookingRef || row.idBooking}
                    </Link>
                ) : (
                    <span className="tw-text-slate-400">—</span>
                )}
                {row.source === 'Rollover' && <div className="tw-text-xs tw-text-violet-700">Rollover</div>}
            </td>
            {!hideInvestor && (
                <td className={TD}>
                    <Link href={`/reports/investors?id=${row.idUsers}`} className="tw-font-medium tw-text-slate-900 hover:tw-text-brand-700">
                        {row.investor}
                    </Link>
                    {row.phone && <div className="tw-text-xs tw-tabular-nums tw-text-slate-500">{row.phone}</div>}
                </td>
            )}
            {!hideProject && (
                <td className={cx(TD, 'tw-min-w-[11rem]')}>
                    <Link href={`/projects/details/${row.idProjects}`} className="tw-text-slate-800 hover:tw-text-brand-700">
                        {row.project}
                    </Link>
                    {row.partners && <div className="tw-line-clamp-1 tw-text-xs tw-text-slate-500" title={row.partners}>{row.partners}</div>}
                </td>
            )}
            <td className={cx(TD, 'tw-text-right tw-tabular-nums')}>{row.units}</td>
            <td className={cx(TD, 'tw-whitespace-nowrap tw-text-right tw-tabular-nums')}>{bdt(row.capital)}</td>
            <td className={cx(TD, 'tw-whitespace-nowrap tw-text-right tw-tabular-nums')}>
                {range(row.minProfit, row.maxProfit)}
                {row.profitFinal && <div className="tw-text-xs tw-text-emerald-700">Final</div>}
            </td>
            <td className={cx(TD, 'tw-whitespace-nowrap tw-text-right tw-font-semibold tw-tabular-nums tw-text-slate-900')}>{range(row.minTotal, row.maxTotal)}</td>
        </tr>
    );
}

function Payables({ report, error }: { report: PayablesReport | null; error: string | null }) {
    const list = useListState(DEFAULTS);
    const { state, update } = list;
    const rows = useMemo(() => report?.rows ?? [], [report]);

    const projects = useMemo(() => {
        const map = new Map<number, string>();
        for (const r of rows) map.set(r.idProjects, r.project);
        return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
    }, [rows]);

    const filtered = useMemo(() => {
        const q = state.q.trim().toLowerCase();
        return rows.filter(
            (r) =>
                (!state.window || r.window === state.window) &&
                (!state.project || String(r.idProjects) === state.project) &&
                (!q || `${r.investor} ${r.phone ?? ''} ${r.project} ${r.partners} ${r.bookingRef ?? ''}`.toLowerCase().includes(q)),
        );
    }, [rows, state.q, state.window, state.project]);

    const totals = useMemo(() => summarizeWindows(filtered), [filtered]);
    const shown = addUp(totals, PAYABLE_WINDOWS.map((w) => w.key));
    const shownCapital = filtered.reduce((s, r) => s + r.capital, 0);

    // `filtered` is already searched, so the kit only sorts and pages it.
    const { total, pageRows } = useClientRows(filtered, { ...state, q: '' }, {
        text: () => '',
        sort: {
            dueDate: (r) => r.dueDate,
            investor: (r) => r.investor,
            project: (r) => r.project,
            units: (r) => r.units,
            capital: (r) => r.capital,
            maxProfit: (r) => r.maxProfit,
            maxTotal: (r) => r.maxTotal,
        },
    });

    const groups = useMemo(() => {
        const key = (r: PayableRow) => (state.view === 'investor' ? String(r.idUsers) : state.view === 'project' ? String(r.idProjects) : r.dueDate);
        const map = new Map<string, PayableRow[]>();
        for (const r of filtered) map.set(key(r), [...(map.get(key(r)) ?? []), r]);
        const list = Array.from(map.values()).map((items) => ({
            key: key(items[0]),
            title: state.view === 'investor' ? items[0].investor : state.view === 'project' ? items[0].project : date(items[0].dueDate),
            note: state.view === 'date' ? dueLabel(items[0]) : `next due ${date(items[0].dueDate)}`,
            items,
            min: items.reduce((s, r) => s + r.minTotal, 0),
            max: items.reduce((s, r) => s + r.maxTotal, 0),
        }));
        return state.view === 'date' ? list : list.sort((a, b) => b.max - a.max);
    }, [filtered, state.view]);

    const chips = filterChips(state, list.defaults, {
        window: (v) => PAYABLE_WINDOWS.find((w) => w.key === v)?.label ?? v,
        project: (v) => `Project: ${projects.find(([id]) => String(id) === v)?.[1] ?? v}`,
    }, update);

    const exportCsv = () =>
        downloadCsv(
            `payables-${report?.today ?? 'forecast'}.csv`,
            ['Due date', 'Days', 'Window', 'Booking', 'Investor', 'Phone', 'Project', 'Partners', 'Source', 'Units', 'Capital', 'Profit (low)', 'Profit (high)', 'Profit final', 'Payable (low)', 'Payable (high)'],
            filtered.map((r) => [
                r.dueDate,
                r.daysLeft,
                PAYABLE_WINDOWS.find((w) => w.key === r.window)?.label,
                r.bookingRef,
                r.investor,
                r.phone,
                r.project,
                r.partners,
                r.source,
                r.units,
                r.capital,
                r.minProfit,
                r.maxProfit,
                r.profitFinal ? 'yes' : 'no',
                r.minTotal,
                r.maxTotal,
            ]),
        );

    if (!report) {
        return (
            <div className="ui">
                <PageHeader eyebrow="Overview" title="Payables forecast" />
                <Card className="tw-border-amber-200 tw-bg-amber-50 tw-p-4 tw-text-sm tw-text-amber-900">
                    <strong>The forecast could not be loaded.</strong> {error}
                </Card>
            </div>
        );
    }

    const dueNow = addUp(report.windows, ['ready', 'overdue']);
    const next30 = addUp(report.windows, ['d15', 'd30']);
    const next90 = addUp(report.windows, ['d15', 'd30', 'd60', 'd90']);
    const all = addUp(report.windows, PAYABLE_WINDOWS.map((w) => w.key));
    const grouped = state.view !== 'all';
    const hideInvestor = state.view === 'investor';
    const hideProject = state.view === 'project';
    // By date, each group's heading already carries the date.
    const hideDue = state.view === 'date';
    const columns = 8 - (hideDue ? 1 : 0) - (hideInvestor ? 1 : 0) - (hideProject ? 1 : 0);

    const head = (
        <thead>
            <tr>
                {!hideDue && (grouped ? <th className={TH}>Due</th> : <SortTH label="Due" field="dueDate" sort={state} onSort={list.sortBy} />)}
                <th className={TH}>Booking</th>
                {!hideInvestor && (grouped ? <th className={TH}>Investor</th> : <SortTH label="Investor" field="investor" sort={state} onSort={list.sortBy} />)}
                {!hideProject && (grouped ? <th className={TH}>Project</th> : <SortTH label="Project" field="project" sort={state} onSort={list.sortBy} />)}
                {grouped ? <th className={cx(TH, 'tw-text-right')}>Units</th> : <SortTH label="Units" field="units" sort={state} onSort={list.sortBy} align="right" />}
                {grouped ? <th className={cx(TH, 'tw-text-right')}>Capital</th> : <SortTH label="Capital" field="capital" sort={state} onSort={list.sortBy} align="right" />}
                {grouped ? <th className={cx(TH, 'tw-text-right')}>Profit</th> : <SortTH label="Profit" field="maxProfit" sort={state} onSort={list.sortBy} align="right" />}
                {grouped ? <th className={cx(TH, 'tw-text-right')}>Payable</th> : <SortTH label="Payable" field="maxTotal" sort={state} onSort={list.sortBy} align="right" />}
            </tr>
        </thead>
    );

    return (
        <div className="ui">
            <PageHeader
                eyebrow="Overview"
                title="Payables forecast"
                description="Every payment due to investors: which booking, which investor, how much and when. Profit shows the project's return range until the final figure is entered."
                actions={
                    <Button onClick={exportCsv} disabled={filtered.length === 0}>
                        <Download className="tw-h-4 tw-w-4" aria-hidden /> Export CSV
                    </Button>
                }
            />

            <div className="tw-grid tw-grid-cols-1 tw-gap-3 sm:tw-grid-cols-2 xl:tw-grid-cols-4">
                <Stat icon={AlertTriangle} label="Due now" min={dueNow.min} max={dueNow.max} note={plural(dueNow.count, 'payment')} tone="tw-bg-rose-50 tw-text-rose-700" />
                <Stat icon={Hourglass} label="Next 30 days" min={next30.min} max={next30.max} note={plural(next30.count, 'payment')} tone="tw-bg-amber-50 tw-text-amber-700" />
                <Stat icon={CalendarClock} label="Next 90 days" min={next90.min} max={next90.max} note={plural(next90.count, 'payment')} tone="tw-bg-sky-50 tw-text-sky-700" />
                <Stat icon={Wallet} label="All scheduled" min={all.min} max={all.max} note={plural(all.count, 'payment')} tone="tw-bg-brand-50 tw-text-brand-700" />
            </div>

            <div className="tw-mt-4 tw-grid tw-grid-cols-2 tw-gap-2 md:tw-grid-cols-4 xl:tw-grid-cols-7" role="group" aria-label="Filter by window">
                {report.windows.map((w) => {
                    const active = state.window === w.key;
                    return (
                        <button
                            key={w.key}
                            type="button"
                            title={w.hint}
                            aria-pressed={active}
                            onClick={() => update({ window: active ? '' : w.key })}
                            className={cx(
                                'tw-rounded-xl tw-border tw-bg-white tw-p-3 tw-text-left tw-transition hover:tw-border-brand-300',
                                active ? 'tw-border-brand-600 tw-ring-2 tw-ring-brand-500/20' : 'tw-border-slate-200',
                            )}
                        >
                            <span className="tw-block tw-text-xs tw-font-medium tw-text-slate-500">{w.label}</span>
                            <span className={cx('tw-mt-1 tw-block tw-truncate tw-text-sm tw-font-semibold tw-tabular-nums', w.count ? WINDOW_TONE[w.key] : 'tw-text-slate-300')}>{w.count ? bdt(w.minTotal) : '—'}</span>
                            <span className="tw-block tw-text-xs tw-tabular-nums tw-text-slate-500">
                                {plural(w.count, 'payment')}
                                {w.investors ? ` · ${plural(w.investors, 'investor')}` : ''}
                            </span>
                        </button>
                    );
                })}
            </div>

            <TableCard
                className="tw-mt-4"
                toolbar={
                    <ListToolbar
                        search={state.q}
                        onSearch={(q) => update({ q })}
                        placeholder="Investor, phone, project, partner or booking"
                        chips={chips}
                        onReset={() => list.reset({ view: state.view } as Partial<typeof DEFAULTS>)}
                        left={
                            <Segmented<View>
                                label="Group by"
                                value={state.view as View}
                                onChange={(view) => update({ view })}
                                options={[
                                    { value: 'date', label: 'By date' },
                                    { value: 'investor', label: 'By investor' },
                                    { value: 'project', label: 'By project' },
                                    { value: 'all', label: 'All rows' },
                                ]}
                            />
                        }
                        filters={
                            <Field label="Project">
                                <Select {...list.bind('project')}>
                                    <option value="">All</option>
                                    {projects.map(([id, name]) => (
                                        <option key={id} value={id}>
                                            {name}
                                        </option>
                                    ))}
                                </Select>
                            </Field>
                        }
                    />
                }
                footer={
                    grouped ? (
                        <div className="tw-flex tw-flex-wrap tw-items-center tw-justify-between tw-gap-2 tw-text-xs tw-text-slate-500">
                            <span>
                                {plural(filtered.length, 'payment')} · capital {bdt(shownCapital)}
                            </span>
                            <span className="tw-font-semibold tw-tabular-nums tw-text-slate-900">Payable {range(shown.min, shown.max)}</span>
                        </div>
                    ) : (
                        <ListFooter page={state.page} pageSize={state.pageSize} total={total} noun="payments" onPage={(page) => update({ page })} onPageSize={(pageSize) => update({ pageSize })} />
                    )
                }
            >
                {head}
                {filtered.length === 0 ? (
                    <tbody>
                        <EmptyRow colSpan={columns} title={rows.length ? 'No payments match' : 'Nothing is scheduled'} hint={rows.length ? 'Try another window or fewer filters.' : undefined} />
                    </tbody>
                ) : grouped ? (
                    groups.map((group) => (
                        <tbody key={group.key}>
                            <tr className="tw-border-t tw-border-slate-200 tw-bg-slate-50">
                                <th scope="rowgroup" colSpan={columns - 1} className="tw-px-4 tw-py-2 tw-text-left tw-text-sm tw-font-semibold tw-text-slate-900">
                                    {group.title}
                                    <span className="tw-ml-2 tw-text-xs tw-font-normal tw-text-slate-500">
                                        {group.note} · {plural(group.items.length, 'payment')}
                                    </span>
                                </th>
                                <td className="tw-whitespace-nowrap tw-px-4 tw-py-2 tw-text-right tw-text-sm tw-font-semibold tw-tabular-nums tw-text-slate-900">{range(group.min, group.max)}</td>
                            </tr>
                            {group.items.map((row) => (
                                <Row key={row.idProjectInvestors} row={row} hideDue={hideDue} hideInvestor={hideInvestor} hideProject={hideProject} />
                            ))}
                        </tbody>
                    ))
                ) : (
                    <tbody>
                        {pageRows.map((row) => (
                            <Row key={row.idProjectInvestors} row={row} />
                        ))}
                    </tbody>
                )}
            </TableCard>

            {report.held.length > 0 && (
                <TableCard
                    className="tw-mt-6"
                    toolbar={
                        <div className="tw-flex tw-flex-wrap tw-items-baseline tw-justify-between tw-gap-2">
                            <div>
                                <p className="tw-text-sm tw-font-semibold tw-text-slate-900">Held for investors</p>
                                <p className="tw-text-xs tw-text-slate-500">Profit and remainders from reinvestments, owed on request. Not included in the windows above.</p>
                            </div>
                            <span className="tw-text-sm tw-font-semibold tw-tabular-nums tw-text-slate-900">{bdt(report.heldTotal)}</span>
                        </div>
                    }
                >
                    <thead>
                        <tr>
                            <th className={TH}>Investor</th>
                            <th className={TH}>Phone</th>
                            <th className={cx(TH, 'tw-text-right')}>Balance</th>
                        </tr>
                    </thead>
                    <tbody>
                        {report.held.map((h) => (
                            <tr key={h.idUsers} className={TR}>
                                <td className={TD}>
                                    <Link href={`/reports/investors?id=${h.idUsers}`} className="tw-font-medium tw-text-slate-900 hover:tw-text-brand-700">
                                        {h.investor}
                                    </Link>
                                </td>
                                <td className={cx(TD, 'tw-tabular-nums tw-text-slate-600')}>{h.phone || '—'}</td>
                                <td className={cx(TD, 'tw-text-right tw-font-medium tw-tabular-nums')}>{bdt(h.balance)}</td>
                            </tr>
                        ))}
                    </tbody>
                </TableCard>
            )}

            {report.windows[0].count > 0 && (
                <p className="tw-mt-4 tw-flex tw-items-center tw-gap-2 tw-text-xs tw-text-slate-500">
                    <Pill tone="violet" dot={false}>Ready to pay</Pill>
                    An admin has set the final profit on these. Mark them withdrawn on the booking once paid.
                </p>
            )}
        </div>
    );
}

export default Payables;

// @ts-ignore
Payables.getLayout = function PageLayout(page: any) {
    return <MainLayout>{page}</MainLayout>;
};

export async function getServerSideProps(context: GetServerSidePropsContext) {
    if (!requireAdminPage(context)) return redirectToLogin;
    try {
        const report = await loadPayables();
        return { props: { report: JSON.parse(JSON.stringify(report)), error: null } };
    } catch (err) {
        console.error('Payables forecast failed:', err);
        return { props: { report: null, error: 'Try again in a moment.' } };
    }
}
