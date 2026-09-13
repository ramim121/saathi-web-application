import React from 'react';
import Link from 'next/link';
import { DrillModal, BookingLink, type Column } from './DrillModal';
import type {
    DashboardDetail,
    PositionRow,
    PayoutRow,
    PendingRow,
    InvestorRow,
} from '@/utils/dashboardDetail';
import type { Drill } from '@/utils/dashboard';

/**
 * The four breakdowns, as column definitions.
 *
 * Kept apart from the modal so the shared behaviour — search, sort, counts,
 * empty states — has one implementation, and each list is just a description of
 * its columns.
 */

const money = (v: number) => `BDT ${v.toLocaleString('en-IN')}`;

const shortDate = (iso: string | null) =>
    iso
        ? new Date(iso).toLocaleDateString('en-GB', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
          })
        : '—';

function prettyType(value: string | null): string {
    if (!value) return '';
    return value
        .split('_')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
}

/**
 * Days remaining, or how long a position has been overdue.
 *
 * A maturity date alone makes the reader do arithmetic against today; the point
 * of a payout queue is to see at a glance what is late.
 */
function DueBadge({ iso }: { iso: string | null }) {
    if (!iso) return <span className="text-muted">—</span>;
    const days = Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000);
    if (days < 0) {
        return <span className="badge bg-danger-subtle text-danger-emphasis">{-days}d overdue</span>;
    }
    if (days === 0) return <span className="badge bg-warning-subtle text-warning-emphasis">today</span>;
    return <span className="badge bg-body-secondary text-body-secondary">in {days}d</span>;
}

const STATUS_TONE: Record<string, string> = {
    pending: 'bg-secondary',
    uploaded: 'bg-info text-dark',
    proof_submitted: 'bg-info text-dark',
};

/* --------------------------------------------------------------- columns -- */

const POSITION_COLUMNS: Column<PositionRow>[] = [
    {
        key: 'investor',
        header: 'Investor',
        sortValue: (r) => r.investor,
        render: (r) => <span className="fw-semibold">{r.investor}</span>,
    },
    {
        key: 'project',
        header: 'Project',
        sortValue: (r) => r.project,
        render: (r) => (
            <>
                <div>{r.project}</div>
                {r.investmentType && (
                    <div className="text-muted small">{prettyType(r.investmentType)}</div>
                )}
            </>
        ),
    },
    { key: 'units', header: 'Units', align: 'end', sortValue: (r) => r.units, render: (r) => r.units },
    {
        key: 'capital',
        header: 'Capital',
        align: 'end',
        sortValue: (r) => r.capital,
        render: (r) => <span className="fw-semibold">{money(r.capital)}</span>,
    },
    {
        key: 'fresh',
        header: 'Fresh / Rollover',
        sortValue: (r) => r.fresh,
        secondary: true,
        render: (r) => (
            <>
                <div className="text-success">{money(r.fresh)}</div>
                {r.rollover > 0 && (
                    <div className="text-muted small">+{money(r.rollover)} rollover</div>
                )}
            </>
        ),
    },
    {
        key: 'profit',
        header: 'Profit (confirmed)',
        align: 'end',
        sortValue: (r) => r.profit ?? -1,
        secondary: true,
        render: (r) => (r.profit == null ? <span className="text-muted">—</span> : money(r.profit)),
    },
    {
        key: 'invDate',
        header: 'Inv. Date',
        sortValue: (r) => r.investmentDate ?? '',
        secondary: true,
        render: (r) => shortDate(r.investmentDate),
    },
    {
        key: 'maturity',
        header: 'Maturity Date',
        sortValue: (r) => r.maturityDate ?? '',
        render: (r) => (
            <>
                <div>{shortDate(r.maturityDate)}</div>
                <DueBadge iso={r.maturityDate} />
            </>
        ),
    },
    {
        key: 'booking',
        header: 'Booking',
        render: (r) => <BookingLink id={r.bookingId} label={r.bookingRef} />,
    },
];

const PAYOUT_COLUMNS: Column<PayoutRow>[] = [
    {
        key: 'investor',
        header: 'Investor',
        sortValue: (r) => r.investor,
        render: (r) => <span className="fw-semibold">{r.investor}</span>,
    },
    { key: 'project', header: 'Project', sortValue: (r) => r.project, render: (r) => r.project },
    {
        key: 'capital',
        header: 'Capital',
        align: 'end',
        sortValue: (r) => r.capital,
        render: (r) => money(r.capital),
    },
    {
        key: 'profit',
        header: 'Profit',
        align: 'end',
        sortValue: (r) => r.profit,
        render: (r) => <span className="text-success">{money(r.profit)}</span>,
    },
    {
        key: 'payable',
        header: 'Total Payable',
        align: 'end',
        sortValue: (r) => r.totalPayable,
        render: (r) => <span className="fw-bold">{money(r.totalPayable)}</span>,
    },
    {
        key: 'maturity',
        header: 'Maturity Date',
        sortValue: (r) => r.maturityDate ?? '',
        render: (r) => (
            <>
                <div>{shortDate(r.maturityDate)}</div>
                <DueBadge iso={r.maturityDate} />
            </>
        ),
    },
    {
        key: 'booking',
        header: 'Booking',
        render: (r) => <BookingLink id={r.bookingId} label={r.bookingRef} />,
    },
];

const PENDING_COLUMNS: Column<PendingRow>[] = [
    {
        key: 'ref',
        header: 'Booking',
        sortValue: (r) => r.bookingRef,
        render: (r) => <span className="font-monospace">{r.bookingRef}</span>,
    },
    {
        key: 'investor',
        header: 'Investor',
        sortValue: (r) => r.investor,
        render: (r) => <span className="fw-semibold">{r.investor}</span>,
    },
    {
        key: 'amount',
        header: 'Amount',
        align: 'end',
        sortValue: (r) => r.amount,
        render: (r) => money(r.amount),
    },
    {
        key: 'method',
        header: 'Method',
        sortValue: (r) => r.method ?? '',
        render: (r) =>
            r.method ? prettyType(r.method) : <span className="text-muted">—</span>,
    },
    {
        key: 'status',
        header: 'Status',
        sortValue: (r) => r.status,
        render: (r) => (
            <span className={`badge ${STATUS_TONE[r.status] ?? 'bg-secondary'}`}>
                {r.status.replace(/_/g, ' ')}
            </span>
        ),
    },
    {
        key: 'submitted',
        header: 'Submitted',
        sortValue: (r) => r.submittedAt ?? '',
        render: (r) => shortDate(r.submittedAt),
    },
    {
        key: 'review',
        header: '',
        render: (r) => (
            <Link
                href={`/bookings/view/${r.idProjectInvestmentBookings}`}
                className="btn btn-sm btn-outline-primary"
            >
                Review
            </Link>
        ),
    },
];

const INVESTOR_COLUMNS: Column<InvestorRow>[] = [
    {
        key: 'investor',
        header: 'Investor',
        sortValue: (r) => r.investor,
        render: (r) => (
            <Link href={`/users/view/${r.idUsers}`} className="fw-semibold text-decoration-none">
                {r.investor}
            </Link>
        ),
    },
    {
        key: 'phone',
        header: 'Phone',
        sortValue: (r) => r.phone ?? '',
        render: (r) =>
            r.phone ? (
                <span className="font-monospace">{r.phone}</span>
            ) : (
                <span className="text-muted">—</span>
            ),
    },
    {
        key: 'positions',
        header: 'Positions',
        align: 'end',
        sortValue: (r) => r.positions,
        render: (r) => r.positions,
    },
    {
        key: 'capital',
        header: 'Total Capital',
        align: 'end',
        sortValue: (r) => r.totalCapital,
        render: (r) => <span className="fw-bold">{money(r.totalCapital)}</span>,
    },
    {
        key: 'pending',
        header: 'Awaiting Payout',
        align: 'end',
        sortValue: (r) => r.maturedPending,
        render: (r) =>
            r.maturedPending > 0 ? (
                <span className="text-warning-emphasis fw-semibold">{money(r.maturedPending)}</span>
            ) : (
                <span className="text-muted">—</span>
            ),
    },
    {
        key: 'projects',
        header: 'Projects',
        secondary: true,
        render: (r) => <span className="small">{r.projects || '—'}</span>,
    },
];

/* ----------------------------------------------------------------- shell -- */

export function DrillSet({
    which,
    detail,
    onClose,
}: {
    which: Drill | null;
    detail: DashboardDetail;
    onClose: () => void;
}) {
    const sum = (ns: number[]) => ns.reduce((a, b) => a + b, 0);

    if (which === 'positions') {
        const total = sum(detail.positions.map((r) => r.capital));
        return (
            <DrillModal<PositionRow>
                open
                onClose={onClose}
                title="Active Investment Positions"
                count={String(detail.positions.length)}
                countTone="brand"
                summary={money(total)}
                rows={detail.positions}
                columns={POSITION_COLUMNS}
                rowKey={(r) => r.idProjectInvestors}
                searchIn={(r) => `${r.investor} ${r.project}`}
                initialSort="maturity"
                empty="No confirmed positions."
            />
        );
    }

    if (which === 'payouts') {
        const total = sum(detail.payouts.map((r) => r.totalPayable));
        return (
            <DrillModal<PayoutRow>
                open
                onClose={onClose}
                title="Withdrawal Queue"
                count={`${detail.payouts.length} pending`}
                countTone="warn"
                summary={`${money(total)} payable`}
                rows={detail.payouts}
                columns={PAYOUT_COLUMNS}
                rowKey={(r) => r.idProjectInvestors}
                searchIn={(r) => `${r.investor} ${r.project}`}
                initialSort="maturity"
                empty="Queue is empty"
            />
        );
    }

    if (which === 'pending') {
        return (
            <DrillModal<PendingRow>
                open
                onClose={onClose}
                title="Pending Payment Confirmations"
                count={String(detail.pending.length)}
                countTone="alert"
                rows={detail.pending}
                columns={PENDING_COLUMNS}
                rowKey={(r) => r.idProjectInvestmentBookings}
                searchIn={(r) => `${r.investor} ${r.bookingRef}`}
                initialSort="submitted"
                initialDirection="desc"
                empty="Nothing awaiting confirmation."
            />
        );
    }

    if (which === 'investors') {
        const total = sum(detail.investors.map((r) => r.totalCapital));
        return (
            <DrillModal<InvestorRow>
                open
                onClose={onClose}
                title="Active Investors"
                count={`${detail.investors.length} distinct`}
                countTone="info"
                rows={detail.investors}
                columns={INVESTOR_COLUMNS}
                rowKey={(r) => r.idUsers}
                searchIn={(r) => `${r.investor} ${r.phone ?? ''} ${r.projects}`}
                initialSort="capital"
                initialDirection="desc"
                footer={
                    /*
                     * Cells must line up with INVESTOR_COLUMNS exactly, including
                     * which ones are hidden below `lg` — a footer that disagrees
                     * with its header shifts every total one column sideways on a
                     * phone. Order: #, investor, phone, positions, capital,
                     * awaiting, projects(secondary).
                     */
                    <tr className="fw-bold">
                        <td />
                        <td>Total</td>
                        <td />
                        <td className="text-end">{sum(detail.investors.map((r) => r.positions))}</td>
                        <td className="text-end">{money(total)}</td>
                        <td className="text-end">
                            {money(sum(detail.investors.map((r) => r.maturedPending)))}
                        </td>
                        <td className="d-none d-lg-table-cell" />
                    </tr>
                }
                empty="No active investors."
            />
        );
    }

    return null;
}
