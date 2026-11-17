import React, { useState, useEffect } from "react";
import MainLayout from "@/layouts/MainLayout";
import Swal from "sweetalert2";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { getRequestOptions } from "@/utils/Fetch";
import { cx } from "@/ui/primitives";
import { EmptyRow, PageHeader, Pager, TableCard, TD, TH, TR } from "@/ui/layout";
import { bdt, date } from "@/ui/format";

/**
 * Active bookings — positions with money working, soonest to mature first in
 * the API's order. Redesigned 2026-11-17; the request, paging and figures are
 * unchanged (amount = units × the project's unit value, as before).
 */

interface BookingListProps {
    Project: {
        projectName: string;
        duration: number;
        tenure: string;
        returnRangeMin: number;
        returnRangeMax: number;
        unitInvestmentValue: number;
    };
    ProjectInvestmentBooking: {
        bookingId: string;
        paymentDate: string;
        User: {
            fullName: string;
        };
    };
    idProjectInvestmentBookings: number;
    investmentDate: string;
    unitPurchased: number;
    totalReturnRange: string;
    maturityDate: string;
    remainingTimeFormatted: string;
}

interface FilterProps {
    orderBy: string;
    orderType: string;
    page: number;
    pageSize: number;
}

function ActiveBooking() {
    const [bookingList, setBookingList] = useState<BookingListProps[]>([]);
    const [filter, setFilter] = useState<FilterProps>({
        orderBy: 'idProjectInvestmentBookings',
        orderType: 'DESC',
        page: 1,
        pageSize: 10
    });
    const [total, setTotal] = useState<number>(0);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        const fetchBookingList = async () => {
            const query = new URLSearchParams(filter as any).toString();
            setLoading(true);
            try {
                const res = await fetch(`/api/bookings/active-booking?${query}`, getRequestOptions());
                const data = await res.json();
                if (res.status === 200) {
                    setBookingList(data.data);
                    setTotal(data.total);
                } else {
                    Swal.fire({ icon: 'error', title: 'Error', text: data.message });
                }
            } catch (err: any) {
                Swal.fire({ icon: 'error', title: 'Error', text: err.message });
            } finally {
                setLoading(false);
            }
        };
        fetchBookingList();
    }, [filter]);

    const totalPages = Math.max(1, Math.ceil(total / filter.pageSize));
    const handlePageChange = (page: number) => setFilter({ ...filter, page: Math.min(Math.max(1, page), totalPages) });

    return (
        <div className="ui">
            <PageHeader
                eyebrow="Bookings"
                title="Active bookings"
                description="Every position with money working, with its expected return and time to maturity."
                actions={
                    <span className="tw-rounded-lg tw-bg-white tw-px-2.5 tw-py-1.5 tw-text-xs tw-font-medium tw-tabular-nums tw-text-slate-600 tw-ring-1 tw-ring-slate-200">
                        {loading ? "Loading…" : `${total.toLocaleString("en-IN")} active`}
                    </span>
                }
            />

            <TableCard footer={<Pager page={filter.page} totalPages={totalPages} onChange={handlePageChange} summary={total ? `Page ${filter.page} of ${totalPages}` : undefined} />}>
                <thead>
                    <tr>
                        <th className={TH}>Booking</th>
                        <th className={TH}>Project</th>
                        <th className={cx(TH, "tw-text-right")}>Amount</th>
                        <th className={cx(TH, "tw-text-right")}>Returnable</th>
                        <th className={TH}>Term</th>
                        <th className={TH}>Remaining</th>
                        <th className={TH}><span className="tw-sr-only">Open</span></th>
                    </tr>
                </thead>
                <tbody className={cx(loading && "tw-opacity-60 tw-transition-opacity")}>
                    {bookingList.length > 0 ? bookingList.map((b, i) => {
                        const { Project: p, ProjectInvestmentBooking: pib } = b;
                        const investmentAmount = b.unitPurchased * p.unitInvestmentValue;
                        return (
                            <tr key={i} className={TR}>
                                <td className={TD}>
                                    <Link href={`/bookings/details/${b.idProjectInvestmentBookings}`} className="tw-font-semibold tw-tabular-nums tw-text-slate-900 hover:tw-text-brand-700">
                                        #{pib?.bookingId || b.idProjectInvestmentBookings}
                                    </Link>
                                    <span className="tw-block tw-text-xs tw-text-slate-500">{pib?.User?.fullName}</span>
                                </td>
                                <td className={TD}>
                                    <span className="tw-block tw-font-medium tw-text-slate-800">{p?.projectName}</span>
                                    <span className="tw-block tw-text-xs tw-tabular-nums tw-text-slate-500">
                                        {b.unitPurchased} × {bdt(Number(p.unitInvestmentValue))} · {`${p.returnRangeMin}–${p.returnRangeMax}%`}
                                    </span>
                                </td>
                                <td className={cx(TD, "tw-whitespace-nowrap tw-text-right tw-font-semibold tw-tabular-nums tw-text-slate-900")}>{bdt(investmentAmount)}</td>
                                <td className={cx(TD, "tw-whitespace-nowrap tw-text-right tw-tabular-nums tw-text-emerald-700")}>{b.totalReturnRange}</td>
                                <td className={cx(TD, "tw-whitespace-nowrap tw-tabular-nums tw-text-slate-600")}>
                                    {date(pib?.paymentDate)} <span className="tw-text-slate-300">→</span> {b.maturityDate !== '-' ? date(b.maturityDate) : '—'}
                                    <span className="tw-block tw-text-xs tw-text-slate-400">{p?.tenure ? `${p.duration} ${p.tenure}` : "—"}</span>
                                </td>
                                <td className={cx(TD, "tw-whitespace-nowrap tw-text-slate-700")}>{b.remainingTimeFormatted}</td>
                                <td className={cx(TD, "tw-text-right")}>
                                    <Link
                                        href={`/bookings/details/${b.idProjectInvestmentBookings}`}
                                        className="tw-inline-flex tw-items-center tw-gap-1 tw-rounded-lg tw-px-2 tw-py-1 tw-text-xs tw-font-semibold tw-text-brand-700 hover:tw-bg-brand-50"
                                    >
                                        Details <ArrowUpRight className="tw-h-3.5 tw-w-3.5" aria-hidden />
                                    </Link>
                                </td>
                            </tr>
                        );
                    }) : (
                        <EmptyRow colSpan={7} title={loading ? "Loading active bookings…" : "No active bookings"} />
                    )}
                </tbody>
            </TableCard>
        </div>
    );
}

export default ActiveBooking;

ActiveBooking.getLayout = function PageLayout(page: any) {
    return <MainLayout>{page}</MainLayout>;
};
