import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import type { GetServerSidePropsContext } from 'next';
import { requireAdminPage, redirectToLogin } from '@/utils/pageAuth';
import {
    loadReports,
    safeDate,
    defaultRange,
    type Reports,
    type ReportRange,
} from '@/utils/reports';

/**
 * Operational reports over a date range.
 *
 * Three questions an operator has to answer to someone else — an auditor, a
 * partner, a board — rather than to themselves: what was placed, what falls due
 * and when, and what was collected by which method. Each is exportable, because
 * the answer usually has to leave this screen.
 */

type Props = { reports: Reports | null; error: string | null };

const money = (v: number) => `BDT ${v.toLocaleString('en-IN')}`;

function prettyType(value: string): string {
    if (!value) return '—';
    return value
        .split('_')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
}

function Panel({
    title,
    subtitle,
    csv,
    children,
}: {
    title: string;
    subtitle?: string;
    csv?: string;
    children: React.ReactNode;
}) {
    return (
        <div className="card">
            <div className="card-header d-flex justify-content-between align-items-start gap-2">
                <div>
                    <h2 className="h6 fw-bold mb-0">{title}</h2>
                    {subtitle && <div className="text-muted small">{subtitle}</div>}
                </div>
                {csv && (
                    <a className="btn btn-sm btn-outline-secondary flex-shrink-0" href={csv}>
                        Export CSV
                    </a>
                )}
            </div>
            <div className="card-body p-0">{children}</div>
        </div>
    );
}

function Empty({ children }: { children: React.ReactNode }) {
    return <p className="text-muted small mb-0 p-3">{children}</p>;
}

/** Quick ranges, because typing two dates to answer "this month" is friction. */
const PRESETS: Array<{ label: string; months: number }> = [
    { label: '1m', months: 1 },
    { label: '3m', months: 3 },
    { label: '6m', months: 6 },
    { label: '12m', months: 12 },
];

function RangeBar({ range }: { range: ReportRange }) {
    const router = useRouter();

    const applyPreset = (months: number) => {
        const to = new Date();
        const from = new Date(to);
        from.setMonth(from.getMonth() - months);
        router.push({
            pathname: '/reports',
            query: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) },
        });
    };

    return (
        <form className="card mb-3" method="get" action="/reports">
            <div className="card-body d-flex flex-wrap align-items-end gap-3 py-3">
                <div>
                    <label className="form-label" htmlFor="from">
                        From
                    </label>
                    <input
                        type="date"
                        id="from"
                        name="from"
                        className="form-control"
                        defaultValue={range.from}
                    />
                </div>
                <div>
                    <label className="form-label" htmlFor="to">
                        To
                    </label>
                    <input
                        type="date"
                        id="to"
                        name="to"
                        className="form-control"
                        defaultValue={range.to}
                    />
                </div>
                <button type="submit" className="btn btn-primary">
                    Apply
                </button>
                <div className="ms-auto d-flex align-items-center gap-1">
                    <span className="text-muted small me-1">Quick:</span>
                    {PRESETS.map((p) => (
                        <button
                            key={p.label}
                            type="button"
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() => applyPreset(p.months)}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
            </div>
        </form>
    );
}

export default function ReportsPage({ reports, error }: Props) {
    if (error || !reports) {
        return (
            <div className="container-fluid py-4">
                <div className="alert alert-warning">
                    <strong>The reports could not be loaded.</strong> {error}
                </div>
            </div>
        );
    }

    const { range, register, schedule, collections, totals } = reports;
    const qs = `from=${range.from}&to=${range.to}`;
    const maxCollection = Math.max(0, ...collections.map((c) => c.amount));

    return (
        <div className="container-fluid py-4">
            <div className="page-head">
                <div>
                    <h1 className="page-title">Reports</h1>
                    <p className="page-subtitle">
                        {range.from} to {range.to}. Amounts are units × unit value; cancelled
                        positions are excluded.
                    </p>
                </div>
                <Link href="/" className="btn btn-sm btn-outline-secondary">
                    Back to dashboard
                </Link>
            </div>

            <RangeBar range={range} />

            <div className="row g-0 gx-3">
                <div className="col-12 col-sm-4 mb-3">
                    <div className="card stat-card h-100 tone-brand">
                        <div className="card-body py-3">
                            <div className="stat-label">Capital placed</div>
                            <div className="stat-value tone-brand">{money(totals.capital)}</div>
                            <div className="stat-note">in the selected range</div>
                        </div>
                    </div>
                </div>
                <div className="col-12 col-sm-4 mb-3">
                    <div className="card stat-card h-100 tone-info">
                        <div className="card-body py-3">
                            <div className="stat-label">Positions</div>
                            <div className="stat-value tone-info">
                                {totals.positions.toLocaleString('en-IN')}
                            </div>
                            <div className="stat-note">confirmed and booked</div>
                        </div>
                    </div>
                </div>
                <div className="col-12 col-sm-4 mb-3">
                    <div className="card stat-card h-100 tone-good">
                        <div className="card-body py-3">
                            <div className="stat-label">Distinct investors</div>
                            <div className="stat-value tone-good">
                                {totals.investors.toLocaleString('en-IN')}
                            </div>
                            <div className="stat-note">placed at least once</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="row g-3 align-items-start">
                <div className="col-12 col-xl-7 d-flex flex-column gap-3">
                    <Panel
                        title="Investment register"
                        subtitle={`${register.length} position${register.length === 1 ? '' : 's'} placed in range`}
                        csv={`/api/reports/export?report=register&${qs}`}
                    >
                        {register.length === 0 ? (
                            <Empty>Nothing was placed between these dates.</Empty>
                        ) : (
                            <div
                                className="table-responsive drill-table"
                                style={{ maxHeight: '28rem' }}
                            >
                                <table className="table table-sm table-hover align-middle">
                                    <thead className="position-sticky top-0">
                                        <tr>
                                            <th>Reference</th>
                                            <th>Investor</th>
                                            <th>Project</th>
                                            <th className="text-end">Units</th>
                                            <th className="text-end">Capital</th>
                                            <th>Source</th>
                                            <th>Placed</th>
                                            <th>Matures</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {register.map((r, i) => (
                                            <tr key={`${r.reference}-${i}`}>
                                                <td className="font-monospace">{r.reference}</td>
                                                <td className="fw-semibold">{r.investor}</td>
                                                <td>
                                                    {r.project}
                                                    <div className="text-muted small">
                                                        {prettyType(r.investmentType)}
                                                    </div>
                                                </td>
                                                <td className="text-end">{r.units}</td>
                                                <td className="text-end fw-semibold">
                                                    {money(r.capital)}
                                                </td>
                                                <td>
                                                    <span
                                                        className={`badge ${r.source === 'Rollover' ? 'bg-info text-dark' : 'bg-success'}`}
                                                    >
                                                        {r.source}
                                                    </span>
                                                </td>
                                                <td>{r.placedOn}</td>
                                                <td>{r.maturesOn}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Panel>
                </div>

                <div className="col-12 col-xl-5 d-flex flex-column gap-3">
                    <Panel
                        title="Payout schedule"
                        subtitle="Grouped by the month a position matures"
                        csv={`/api/reports/export?report=schedule&${qs}`}
                    >
                        {schedule.length === 0 ? (
                            <Empty>Nothing matures between these dates.</Empty>
                        ) : (
                            <div className="table-responsive drill-table">
                                <table className="table table-sm table-hover align-middle">
                                    <thead>
                                        <tr>
                                            <th>Month</th>
                                            <th className="text-end">Positions</th>
                                            <th className="text-end">Capital</th>
                                            <th className="text-end">Payable range</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {schedule.map((r) => (
                                            <tr key={r.month}>
                                                <td className="fw-semibold">{r.month}</td>
                                                <td className="text-end">{r.positions}</td>
                                                <td className="text-end">{money(r.capital)}</td>
                                                <td className="text-end">
                                                    {money(r.minPayable)}
                                                    {r.maxPayable !== r.minPayable && (
                                                        <div className="text-muted small">
                                                            up to {money(r.maxPayable)}
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        <p className="text-muted small mb-0 px-3 py-2 border-top">
                            Each project quotes a return <strong>range</strong>, so the payable is a
                            band rather than a single figure.
                        </p>
                    </Panel>

                    <Panel
                        title="Collections by method"
                        subtitle="Confirmed payments only"
                        csv={`/api/reports/export?report=collections&${qs}`}
                    >
                        {collections.length === 0 ? (
                            <Empty>No payments were confirmed between these dates.</Empty>
                        ) : (
                            <div className="table-responsive">
                                <table className="table table-sm table-hover align-middle">
                                    <thead>
                                        <tr>
                                            <th>Method</th>
                                            <th className="text-end">Bookings</th>
                                            <th className="text-end">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {collections.map((r) => (
                                            <tr key={r.method}>
                                                <td className="fw-semibold">
                                                    {prettyType(r.method)}
                                                </td>
                                                <td className="text-end">{r.bookings}</td>
                                                <td className="text-end">
                                                    {money(r.amount)}
                                                    <div
                                                        className="progress mt-1"
                                                        style={{ height: 4 }}
                                                        role="presentation"
                                                    >
                                                        <div
                                                            className="progress-bar"
                                                            style={{
                                                                width: `${maxCollection > 0 ? Math.max(2, Math.round((r.amount / maxCollection) * 100)) : 0}%`,
                                                            }}
                                                        />
                                                    </div>
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
    );
}

export async function getServerSideProps(context: GetServerSidePropsContext) {
    if (!requireAdminPage(context)) return redirectToLogin;

    const fallback = defaultRange();
    const range: ReportRange = {
        from: safeDate(context.query.from, fallback.from),
        to: safeDate(context.query.to, fallback.to),
    };

    try {
        const reports = await loadReports(range);
        return { props: { reports: JSON.parse(JSON.stringify(reports)) as Reports, error: null } };
    } catch (error) {
        return { props: { reports: null, error: (error as Error).message } };
    }
}
