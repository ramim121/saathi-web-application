import React, { type ReactNode } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import type { GetServerSidePropsContext } from 'next';
import { AlertTriangle, Download, Layers3, Users, Wallet, type LucideIcon } from 'lucide-react';
import MainLayout from '@/layouts/MainLayout';
import { requireAdminPage, redirectToLogin } from '@/utils/pageAuth';
import {
    loadReports,
    safeDate,
    defaultRange,
    type Reports,
    type ReportRange,
} from '@/utils/reports';
import { bdt, date, monthYear, plural } from '@/ui/format';
import { Card, Pill, cx } from '@/ui/primitives';
import { Button, Field, Input, buttonClass } from '@/ui/controls';
import { PageHeader, TD, TH, TR } from '@/ui/layout';

/**
 * Operational reports over a date range.
 *
 * Three questions an operator has to answer to someone else — an auditor, a
 * partner, a board — rather than to themselves: what was placed, what falls due
 * and when, and what was collected by which method. Each is exportable, because
 * the answer usually has to leave this screen.
 */

type Props = { reports: Reports | null; error: string | null };

function prettyType(value: string): string {
    if (!value) return '—';
    return value
        .split('_')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
}

/** Same card as the investor report's figures, so the two reports read alike. */
function Stat({
    icon: IconCmp,
    label,
    value,
    hint,
    emphasis,
    accent,
}: {
    icon: LucideIcon;
    label: string;
    value: string;
    hint?: ReactNode;
    emphasis?: boolean;
    accent?: 'sky' | 'amber';
}) {
    return (
        <div
            className={cx(
                'tw-rounded-2xl tw-border tw-p-4 tw-shadow-card',
                emphasis ? 'tw-border-brand-700 tw-bg-gradient-to-br tw-from-brand-700 tw-to-brand-800 tw-text-white' : 'tw-border-slate-200 tw-bg-white',
            )}
        >
            <div className={cx('tw-flex tw-items-center tw-gap-2 tw-text-[13px] tw-font-medium', emphasis ? 'tw-text-brand-100' : 'tw-text-slate-500')}>
                <span
                    className={cx(
                        'tw-inline-flex tw-h-6 tw-w-6 tw-items-center tw-justify-center tw-rounded-lg',
                        emphasis
                            ? 'tw-bg-white/15'
                            : accent === 'sky'
                              ? 'tw-bg-sky-50 tw-text-sky-600'
                              : accent === 'amber'
                                ? 'tw-bg-amber-50 tw-text-amber-600'
                                : 'tw-bg-slate-100 tw-text-slate-500',
                    )}
                >
                    <IconCmp className="tw-h-3.5 tw-w-3.5" aria-hidden />
                </span>
                {label}
            </div>
            <div className={cx('tw-mt-2.5 tw-truncate tw-text-[22px] tw-font-semibold tw-leading-7 tw-tracking-tight tw-tabular-nums', emphasis ? 'tw-text-white' : 'tw-text-slate-900')}>
                {value}
            </div>
            {hint && <div className={cx('tw-mt-1 tw-text-xs', emphasis ? 'tw-text-brand-100' : 'tw-text-slate-500')}>{hint}</div>}
        </div>
    );
}

function Panel({
    title,
    subtitle,
    csv,
    footer,
    children,
}: {
    title: string;
    subtitle?: string;
    csv?: string;
    footer?: ReactNode;
    children: ReactNode;
}) {
    return (
        <Card className="tw-overflow-hidden">
            <div className="tw-flex tw-items-start tw-justify-between tw-gap-3 tw-border-b tw-border-slate-100 tw-px-5 tw-py-4">
                <div className="tw-min-w-0">
                    <h2 className="tw-text-sm tw-font-semibold tw-text-slate-900">{title}</h2>
                    {subtitle && <p className="tw-mt-0.5 tw-text-xs tw-text-slate-500">{subtitle}</p>}
                </div>
                {csv && (
                    // A plain link: the export is a file download, not a page.
                    <a className={buttonClass('secondary', 'sm', 'tw-shrink-0')} href={csv}>
                        <Download className="tw-h-3.5 tw-w-3.5" aria-hidden />
                        Export CSV
                    </a>
                )}
            </div>
            {children}
            {footer && <div className="tw-border-t tw-border-slate-100 tw-px-5 tw-py-3 tw-text-xs tw-text-slate-500">{footer}</div>}
        </Card>
    );
}

function Empty({ children }: { children: ReactNode }) {
    return <p className="tw-px-5 tw-py-10 tw-text-center tw-text-sm tw-text-slate-500">{children}</p>;
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
        <Card className="tw-mb-6 tw-p-4">
            <form className="tw-flex tw-flex-wrap tw-items-end tw-gap-3" method="get" action="/reports">
                <Field label="From" className="tw-w-44">
                    <Input type="date" id="from" name="from" defaultValue={range.from} />
                </Field>
                <Field label="To" className="tw-w-44">
                    <Input type="date" id="to" name="to" defaultValue={range.to} />
                </Field>
                <Button variant="primary" type="submit">
                    Apply
                </Button>
                <div className="tw-flex tw-items-center tw-gap-2 sm:tw-ml-auto">
                    <span className="tw-text-xs tw-font-medium tw-text-slate-500">Last</span>
                    <div className="tw-flex tw-gap-1 tw-rounded-xl tw-bg-slate-100 tw-p-1">
                        {PRESETS.map((p) => (
                            <button
                                key={p.label}
                                type="button"
                                onClick={() => applyPreset(p.months)}
                                className="tw-rounded-lg tw-px-2.5 tw-py-1 tw-text-xs tw-font-medium tw-text-slate-600 tw-transition hover:tw-bg-white hover:tw-text-slate-900 hover:tw-shadow-sm focus-visible:tw-outline-none focus-visible:tw-ring-2 focus-visible:tw-ring-brand-500"
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>
                </div>
            </form>
        </Card>
    );
}

const TITLE = 'Operations report';

export default function ReportsPage({ reports, error }: Props) {
    if (error || !reports) {
        return (
            <div className="ui">
                <Head>
                    <title>{`${TITLE} · Shathi admin`}</title>
                </Head>
                <PageHeader eyebrow="Reports" title={TITLE} />
                <div className="tw-flex tw-items-start tw-gap-3 tw-rounded-2xl tw-border tw-border-amber-200 tw-bg-amber-50 tw-p-4 tw-text-sm tw-text-amber-900">
                    <AlertTriangle className="tw-mt-0.5 tw-h-4 tw-w-4 tw-shrink-0" aria-hidden />
                    <p>
                        <strong className="tw-font-semibold">The reports could not be loaded.</strong> {error}
                    </p>
                </div>
            </div>
        );
    }

    const { range, register, schedule, collections, totals } = reports;
    const qs = `from=${range.from}&to=${range.to}`;
    const maxCollection = Math.max(0, ...collections.map((c) => c.amount));

    return (
        <div className="ui">
            <Head>
                <title>{`${TITLE} · Shathi admin`}</title>
            </Head>
            <PageHeader
                eyebrow="Reports"
                title={TITLE}
                description={
                    <>
                        {date(range.from)} to {date(range.to)}. Amounts are units × unit value; cancelled positions are excluded.
                    </>
                }
            />

            {/* Keyed by the range so the date fields show a quick range after it is applied. */}
            <RangeBar key={`${range.from}:${range.to}`} range={range} />

            <div className="tw-mb-6 tw-grid tw-grid-cols-1 tw-gap-3 sm:tw-grid-cols-3">
                <Stat emphasis icon={Wallet} label="Capital placed" value={bdt(totals.capital)} hint="in the selected range" />
                <Stat icon={Layers3} accent="sky" label="Positions" value={totals.positions.toLocaleString('en-IN')} hint="confirmed and booked" />
                <Stat icon={Users} accent="amber" label="Distinct investors" value={totals.investors.toLocaleString('en-IN')} hint="placed at least once" />
            </div>

            {/* The register is the widest table, so it gets the full width; the two
                summaries sit side by side under it. grid-cols-1 (minmax(0,1fr)) lets a
                wide table scroll inside its card on a phone. */}
            <div className="tw-grid tw-grid-cols-1 tw-items-start tw-gap-6">
                <Panel title="Investment register" subtitle={`${plural(register.length, 'position')} placed in range`} csv={`/api/reports/export?report=register&${qs}`}>
                    {register.length === 0 ? (
                        <Empty>Nothing was placed between these dates.</Empty>
                    ) : (
                        <div className="tw-max-h-[28rem] tw-overflow-auto">
                            <table className="tw-w-full tw-text-sm">
                                <thead className="tw-sticky tw-top-0 tw-z-10 tw-bg-white">
                                    <tr>
                                        <th className={TH}>Reference</th>
                                        <th className={TH}>Investor</th>
                                        <th className={TH}>Project</th>
                                        <th className={cx(TH, 'tw-text-right')}>Units</th>
                                        <th className={cx(TH, 'tw-text-right')}>Capital</th>
                                        <th className={TH}>Source</th>
                                        <th className={TH}>Placed</th>
                                        <th className={TH}>Matures</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {register.map((r, i) => (
                                        <tr key={`${r.reference}-${i}`} className={TR}>
                                            <td className={cx(TD, 'tw-whitespace-nowrap tw-font-mono tw-text-xs tw-text-slate-600')}>{r.reference}</td>
                                            <td className={cx(TD, 'tw-min-w-[9rem] tw-font-medium tw-text-slate-900')}>{r.investor}</td>
                                            <td className={cx(TD, 'tw-min-w-[10rem]')}>
                                                <div className="tw-text-slate-800">{r.project}</div>
                                                <div className="tw-text-xs tw-text-slate-500">{prettyType(r.investmentType)}</div>
                                            </td>
                                            <td className={cx(TD, 'tw-text-right tw-tabular-nums')}>{r.units}</td>
                                            <td className={cx(TD, 'tw-whitespace-nowrap tw-text-right tw-font-medium tw-tabular-nums tw-text-slate-900')}>{bdt(r.capital)}</td>
                                            <td className={TD}>
                                                <Pill tone={r.source === 'Rollover' ? 'sky' : 'green'} dot={false}>
                                                    {r.source}
                                                </Pill>
                                            </td>
                                            <td className={cx(TD, 'tw-whitespace-nowrap tw-tabular-nums tw-text-slate-600')}>{date(r.placedOn)}</td>
                                            <td className={cx(TD, 'tw-whitespace-nowrap tw-tabular-nums tw-text-slate-600')}>{date(r.maturesOn)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </Panel>

                <div className="tw-grid tw-min-w-0 tw-grid-cols-1 tw-items-start tw-gap-6 lg:tw-grid-cols-2">
                    <Panel
                        title="Payout schedule"
                        subtitle="Grouped by the month a position matures"
                        csv={`/api/reports/export?report=schedule&${qs}`}
                        footer={
                            <>
                                Each project quotes a return <strong className="tw-font-semibold tw-text-slate-700">range</strong>, so the payable is a band rather than a single figure.{' '}
                                <Link href="/reports/payables" className="tw-font-semibold tw-text-brand-700 hover:tw-underline">
                                    See each payment by date
                                </Link>
                            </>
                        }
                    >
                        {schedule.length === 0 ? (
                            <Empty>Nothing matures between these dates.</Empty>
                        ) : (
                            <div className="tw-overflow-x-auto">
                                <table className="tw-w-full tw-text-sm">
                                    <thead>
                                        <tr>
                                            <th className={TH}>Month</th>
                                            <th className={cx(TH, 'tw-text-right')}>Positions</th>
                                            <th className={cx(TH, 'tw-text-right')}>Capital</th>
                                            <th className={cx(TH, 'tw-text-right')}>Payable range</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {schedule.map((r) => (
                                            <tr key={r.month} className={TR}>
                                                <td className={cx(TD, 'tw-whitespace-nowrap tw-font-medium tw-text-slate-900')}>{monthYear(r.month)}</td>
                                                <td className={cx(TD, 'tw-text-right tw-tabular-nums')}>{r.positions}</td>
                                                <td className={cx(TD, 'tw-whitespace-nowrap tw-text-right tw-tabular-nums')}>{bdt(r.capital)}</td>
                                                <td className={cx(TD, 'tw-whitespace-nowrap tw-text-right tw-tabular-nums')}>
                                                    <span className="tw-font-medium tw-text-slate-900">{bdt(r.minPayable)}</span>
                                                    {r.maxPayable !== r.minPayable && <div className="tw-text-xs tw-text-slate-500">up to {bdt(r.maxPayable)}</div>}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Panel>

                    <Panel title="Collections by method" subtitle="Confirmed payments only" csv={`/api/reports/export?report=collections&${qs}`}>
                        {collections.length === 0 ? (
                            <Empty>No payments were confirmed between these dates.</Empty>
                        ) : (
                            <div className="tw-overflow-x-auto">
                                <table className="tw-w-full tw-text-sm">
                                    <thead>
                                        <tr>
                                            <th className={TH}>Method</th>
                                            <th className={cx(TH, 'tw-text-right')}>Bookings</th>
                                            <th className={cx(TH, 'tw-text-right')}>Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {collections.map((r) => (
                                            <tr key={r.method} className={TR}>
                                                <td className={cx(TD, 'tw-font-medium tw-text-slate-900')}>{prettyType(r.method)}</td>
                                                <td className={cx(TD, 'tw-text-right tw-tabular-nums')}>{r.bookings}</td>
                                                <td className={cx(TD, 'tw-w-44 tw-text-right')}>
                                                    <span className="tw-whitespace-nowrap tw-tabular-nums">{bdt(r.amount)}</span>
                                                    <div className="tw-mt-1.5 tw-h-1 tw-w-full tw-overflow-hidden tw-rounded-full tw-bg-slate-100" role="presentation">
                                                        <div
                                                            className="tw-ml-auto tw-h-1 tw-rounded-full tw-bg-brand-600"
                                                            style={{ width: `${maxCollection > 0 ? Math.max(2, Math.round((r.amount / maxCollection) * 100)) : 0}%` }}
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

ReportsPage.getLayout = function PageLayout(page: ReactNode) {
    return <MainLayout>{page}</MainLayout>;
};

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
