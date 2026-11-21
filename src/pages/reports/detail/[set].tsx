import React, { useCallback, type ReactNode } from 'react';
import Link from 'next/link';
import type { GetServerSidePropsContext } from 'next';
import { ArrowLeft, Download } from 'lucide-react';
import MainLayout from '@/layouts/MainLayout';
import { requireAdminPage, redirectToLogin } from '@/utils/pageAuth';
import { loadDashboardDetail, type InvestorRow, type PendingRow, type PositionRow } from '@/utils/dashboardDetail';
import { Card, Pill, cx } from '@/ui/primitives';
import { Button, Field, Select } from '@/ui/controls';
import { EmptyRow, PageHeader, TableCard, TD, TH, TR } from '@/ui/layout';
import { ListFooter, ListToolbar, SortTH, filterChips, useClientRows, useListState } from '@/ui/table';
import { bdt, date, plural } from '@/ui/format';
import { paymentStatus, words } from '@/ui/status';
import { downloadCsv } from '@/ui/csv';

/**
 * The rows behind each dashboard figure, as a full page: search, filter, sort,
 * page and export. The dashboard keeps only the totals.
 */

type Column<R> = {
    key: string;
    label: string;
    right?: boolean;
    sort?: (r: R) => string | number | null | undefined;
    csv: (r: R) => unknown;
    render: (r: R) => ReactNode;
};

type Filter<R> = { label: string; options: { value: string; label: string }[]; match: (r: R, value: string) => boolean };

const day = (v: string | null) => (v ? date(v) : '—');

function BookingRef({ id, reference }: { id: number | null; reference: string | null }) {
    return id ? (
        <Link href={`/bookings/details/${id}`} className="tw-font-semibold tw-tabular-nums tw-text-brand-700 hover:tw-underline">
            #{reference || id}
        </Link>
    ) : (
        <span className="tw-text-slate-400">—</span>
    );
}

function DetailTable<R>({
    title,
    description,
    noun,
    rows,
    columns,
    rowKey,
    text,
    defaultSort,
    defaultDir,
    filter,
    stats,
    file,
}: {
    title: string;
    description: string;
    noun: string;
    rows: R[];
    columns: Column<R>[];
    rowKey: (r: R) => number;
    text: (r: R) => string;
    defaultSort: string;
    defaultDir: 'ASC' | 'DESC';
    filter?: Filter<R>;
    stats: { label: string; value: string }[];
    file: string;
}) {
    const list = useListState({ q: '', only: '', orderBy: defaultSort, orderType: defaultDir, page: 1, pageSize: 25 });
    const { state, update } = list;
    const only = state.only;
    const byFilter = useCallback((r: R) => !only || !filter || filter.match(r, only), [only, filter]);
    const sort = Object.fromEntries(columns.filter((c) => c.sort).map((c) => [c.key, c.sort!]));
    const { total, pageRows } = useClientRows(rows, state, { text, sort, filter: byFilter });
    const chips = filterChips(state, list.defaults, { only: (v) => filter?.options.find((o) => o.value === v)?.label ?? v }, update);

    const exportCsv = () => {
        const q = state.q.trim().toLowerCase();
        const out = rows.filter((r) => byFilter(r) && (!q || text(r).toLowerCase().includes(q)));
        downloadCsv(file, columns.map((c) => c.label), out.map((r) => columns.map((c) => c.csv(r))));
    };

    return (
        <div className="ui">
            <Link href="/" className="tw-mb-3 tw-inline-flex tw-items-center tw-gap-1 tw-text-xs tw-font-semibold tw-text-slate-500 hover:tw-text-brand-700">
                <ArrowLeft className="tw-h-3.5 tw-w-3.5" aria-hidden /> Dashboard
            </Link>
            <PageHeader
                eyebrow="Overview"
                title={title}
                description={description}
                actions={
                    <Button onClick={exportCsv} disabled={rows.length === 0}>
                        <Download className="tw-h-4 tw-w-4" aria-hidden /> Export CSV
                    </Button>
                }
            />
            <div className="tw-mb-4 tw-grid tw-grid-cols-2 tw-gap-3 lg:tw-grid-cols-4">
                {stats.map((s) => (
                    <Card key={s.label} className="tw-p-4">
                        <div className="tw-text-[13px] tw-font-medium tw-text-slate-500">{s.label}</div>
                        <div className="tw-mt-1.5 tw-truncate tw-text-xl tw-font-semibold tw-tabular-nums tw-text-slate-900">{s.value}</div>
                    </Card>
                ))}
            </div>
            <TableCard
                toolbar={
                    <ListToolbar
                        search={state.q}
                        onSearch={(q) => update({ q })}
                        placeholder="Search"
                        chips={chips}
                        onReset={() => list.reset()}
                        filters={
                            filter ? (
                                <Field label={filter.label}>
                                    <Select {...list.bind('only')}>
                                        <option value="">All</option>
                                        {filter.options.map((o) => (
                                            <option key={o.value} value={o.value}>
                                                {o.label}
                                            </option>
                                        ))}
                                    </Select>
                                </Field>
                            ) : undefined
                        }
                    />
                }
                footer={<ListFooter page={state.page} pageSize={state.pageSize} total={total} noun={noun} onPage={(page) => update({ page })} onPageSize={(pageSize) => update({ pageSize })} />}
            >
                <thead>
                    <tr>
                        {columns.map((c) =>
                            c.sort ? (
                                <SortTH key={c.key} label={c.label} field={c.key} sort={state} onSort={list.sortBy} align={c.right ? 'right' : 'left'} />
                            ) : (
                                <th key={c.key} className={cx(TH, c.right && 'tw-text-right')}>
                                    {c.label}
                                </th>
                            ),
                        )}
                    </tr>
                </thead>
                <tbody>
                    {pageRows.length === 0 ? (
                        <EmptyRow colSpan={columns.length} title={`No ${noun} match`} hint={rows.length ? 'Try other words or fewer filters.' : undefined} />
                    ) : (
                        pageRows.map((r) => (
                            <tr key={rowKey(r)} className={TR}>
                                {columns.map((c) => (
                                    <td key={c.key} className={cx(TD, c.right && 'tw-whitespace-nowrap tw-text-right tw-tabular-nums')}>
                                        {c.render(r)}
                                    </td>
                                ))}
                            </tr>
                        ))
                    )}
                </tbody>
            </TableCard>
        </div>
    );
}

const investorLink = (id: number, name: string) => (
    <Link href={`/reports/investors?id=${id}`} className="tw-font-medium tw-text-slate-900 hover:tw-text-brand-700">
        {name}
    </Link>
);

const POSITION_COLUMNS: Column<PositionRow>[] = [
    { key: 'booking', label: 'Booking', sort: (r) => r.bookingRef, csv: (r) => r.bookingRef, render: (r) => <BookingRef id={r.bookingId} reference={r.bookingRef} /> },
    { key: 'investor', label: 'Investor', sort: (r) => r.investor, csv: (r) => r.investor, render: (r) => <span className="tw-font-medium tw-text-slate-900">{r.investor}</span> },
    { key: 'project', label: 'Project', sort: (r) => r.project, csv: (r) => r.project, render: (r) => r.project },
    { key: 'source', label: 'Source', sort: (r) => (r.rollover > 0 ? 'Rollover' : 'Fresh'), csv: (r) => (r.rollover > 0 ? 'Rollover' : 'Fresh'), render: (r) => <Pill tone={r.rollover > 0 ? 'violet' : 'green'} dot={false}>{r.rollover > 0 ? 'Rollover' : 'Fresh'}</Pill> },
    { key: 'units', label: 'Units', right: true, sort: (r) => r.units, csv: (r) => r.units, render: (r) => r.units },
    { key: 'capital', label: 'Capital', right: true, sort: (r) => r.capital, csv: (r) => r.capital, render: (r) => <span className="tw-font-semibold tw-text-slate-900">{bdt(r.capital)}</span> },
    { key: 'start', label: 'Started', sort: (r) => r.investmentDate, csv: (r) => r.investmentDate?.slice(0, 10), render: (r) => <span className="tw-whitespace-nowrap tw-tabular-nums">{day(r.investmentDate)}</span> },
    { key: 'maturity', label: 'Matures', sort: (r) => r.maturityDate, csv: (r) => r.maturityDate?.slice(0, 10), render: (r) => <span className="tw-whitespace-nowrap tw-tabular-nums">{day(r.maturityDate)}</span> },
];

const PENDING_COLUMNS: Column<PendingRow>[] = [
    { key: 'booking', label: 'Booking', sort: (r) => r.bookingRef, csv: (r) => r.bookingRef, render: (r) => <BookingRef id={r.idProjectInvestmentBookings} reference={r.bookingRef} /> },
    { key: 'investor', label: 'Investor', sort: (r) => r.investor, csv: (r) => r.investor, render: (r) => <span className="tw-font-medium tw-text-slate-900">{r.investor}</span> },
    { key: 'amount', label: 'Amount', right: true, sort: (r) => r.amount, csv: (r) => r.amount, render: (r) => <span className="tw-font-semibold tw-text-slate-900">{bdt(r.amount)}</span> },
    { key: 'method', label: 'Method', sort: (r) => r.method, csv: (r) => r.method, render: (r) => (r.method ? words(r.method) : <span className="tw-text-slate-300">—</span>) },
    {
        key: 'status',
        label: 'Status',
        sort: (r) => r.status,
        csv: (r) => r.status,
        render: (r) => {
            const s = paymentStatus(r.status);
            return <Pill tone={s.tone}>{s.label}</Pill>;
        },
    },
    { key: 'submitted', label: 'Placed', sort: (r) => r.submittedAt, csv: (r) => r.submittedAt?.slice(0, 10), render: (r) => <span className="tw-whitespace-nowrap tw-tabular-nums">{day(r.submittedAt)}</span> },
];

const INVESTOR_COLUMNS: Column<InvestorRow>[] = [
    { key: 'investor', label: 'Investor', sort: (r) => r.investor, csv: (r) => r.investor, render: (r) => investorLink(r.idUsers, r.investor) },
    { key: 'phone', label: 'Phone', csv: (r) => r.phone, render: (r) => <span className="tw-tabular-nums tw-text-slate-600">{r.phone || '—'}</span> },
    { key: 'positions', label: 'Positions', right: true, sort: (r) => r.positions, csv: (r) => r.positions, render: (r) => r.positions },
    { key: 'totalCapital', label: 'Capital', right: true, sort: (r) => r.totalCapital, csv: (r) => r.totalCapital, render: (r) => <span className="tw-font-semibold tw-text-slate-900">{bdt(r.totalCapital)}</span> },
    { key: 'maturedPending', label: 'Matured, unpaid', right: true, sort: (r) => r.maturedPending, csv: (r) => r.maturedPending, render: (r) => (r.maturedPending > 0 ? <span className="tw-font-medium tw-text-amber-700">{bdt(r.maturedPending)}</span> : <span className="tw-text-slate-300">—</span>) },
    { key: 'projects', label: 'Projects', csv: (r) => r.projects, render: (r) => <span className="tw-line-clamp-2 tw-max-w-md tw-text-slate-600" title={r.projects}>{r.projects}</span> },
];

const SOURCE_FILTER: Filter<PositionRow> = {
    label: 'Source',
    options: [
        { value: 'fresh', label: 'Fresh money' },
        { value: 'rollover', label: 'Rollover' },
    ],
    match: (r, v) => (v === 'rollover' ? r.rollover > 0 : r.rollover === 0),
};

const PENDING_FILTER: Filter<PendingRow> = {
    label: 'Status',
    options: [
        { value: 'pending', label: 'Awaiting payment' },
        { value: 'uploaded', label: 'Proof uploaded' },
        { value: 'proof_submitted', label: 'Proof submitted' },
    ],
    match: (r, v) => r.status === v,
};

type Props =
    | { set: 'positions'; rows: PositionRow[] }
    | { set: 'pending'; rows: PendingRow[] }
    | { set: 'investors'; rows: InvestorRow[] };

function DetailPage(props: Props) {
    if (props.set === 'positions') {
        const capital = props.rows.reduce((s, r) => s + r.capital, 0);
        const fresh = props.rows.reduce((s, r) => s + r.fresh, 0);
        const rollover = props.rows.reduce((s, r) => s + r.rollover, 0);
        return (
            <DetailTable<PositionRow>
                key="positions"
                title="Active investments"
                description="Every confirmed position: who holds it, in which project, and when it matures."
                noun="positions"
                rows={props.rows}
                columns={POSITION_COLUMNS}
                rowKey={(r) => r.idProjectInvestors}
                text={(r) => `${r.investor} ${r.project} ${r.bookingRef ?? ''}`}
                defaultSort="maturity"
                defaultDir="ASC"
                filter={SOURCE_FILTER}
                file="active-investments.csv"
                stats={[
                    { label: 'Positions', value: props.rows.length.toLocaleString('en-IN') },
                    { label: 'Total capital', value: bdt(capital) },
                    { label: 'Fresh money', value: bdt(fresh) },
                    { label: 'Rolled over', value: bdt(rollover) },
                ]}
            />
        );
    }
    if (props.set === 'pending') {
        const amount = props.rows.reduce((s, r) => s + r.amount, 0);
        const withProof = props.rows.filter((r) => r.status !== 'pending').length;
        return (
            <DetailTable<PendingRow>
                key="pending"
                title="Pending payments"
                description="Bookings waiting for payment or for an admin to confirm the proof."
                noun="bookings"
                rows={props.rows}
                columns={PENDING_COLUMNS}
                rowKey={(r) => r.idProjectInvestmentBookings}
                text={(r) => `${r.investor} ${r.bookingRef} ${r.method ?? ''}`}
                defaultSort="submitted"
                defaultDir="DESC"
                filter={PENDING_FILTER}
                file="pending-payments.csv"
                stats={[
                    { label: 'Bookings', value: props.rows.length.toLocaleString('en-IN') },
                    { label: 'Amount', value: bdt(amount) },
                    { label: 'Proof to review', value: plural(withProof, 'booking') },
                    { label: 'No proof yet', value: plural(props.rows.length - withProof, 'booking') },
                ]}
            />
        );
    }
    const capital = props.rows.reduce((s, r) => s + r.totalCapital, 0);
    const matured = props.rows.reduce((s, r) => s + r.maturedPending, 0);
    return (
        <DetailTable<InvestorRow>
            key="investors"
            title="Active investors"
            description="Everyone with a confirmed or reserved position. Open a name for the full investor report."
            noun="investors"
            rows={props.rows}
            columns={INVESTOR_COLUMNS}
            rowKey={(r) => r.idUsers}
            text={(r) => `${r.investor} ${r.phone ?? ''} ${r.projects}`}
            defaultSort="totalCapital"
            defaultDir="DESC"
            file="active-investors.csv"
            stats={[
                { label: 'Investors', value: props.rows.length.toLocaleString('en-IN') },
                { label: 'Total capital', value: bdt(capital) },
                { label: 'Average', value: bdt(props.rows.length ? capital / props.rows.length : 0) },
                { label: 'Matured, unpaid', value: bdt(matured) },
            ]}
        />
    );
}

export default DetailPage;

// @ts-ignore
DetailPage.getLayout = function PageLayout(page: any) {
    return <MainLayout>{page}</MainLayout>;
};

export async function getServerSideProps(context: GetServerSidePropsContext) {
    if (!requireAdminPage(context)) return redirectToLogin;
    const set = String(context.params?.set);
    if (set === 'payouts') return { redirect: { destination: '/reports/payables?window=overdue', permanent: false } };
    if (set !== 'positions' && set !== 'pending' && set !== 'investors') return { notFound: true };
    const detail = await loadDashboardDetail();
    return { props: { set, rows: JSON.parse(JSON.stringify(detail[set])) } };
}
