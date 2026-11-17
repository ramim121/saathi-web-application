import React, { useState, useEffect } from "react";
import MainLayout from "@/layouts/MainLayout";
import Swal from "sweetalert2";
import Link from "next/link";
import { ArrowUpRight, Plus } from "lucide-react";
import { getRequestOptions } from "@/utils/Fetch";
import { Pill, Segmented, cx } from "@/ui/primitives";
import { Field, Input, LinkButton, SearchInput, Select } from "@/ui/controls";
import { EmptyRow, PageHeader, Pager, TableCard, TD, TH, TR } from "@/ui/layout";
import { investmentStatus, paymentStatus } from "@/ui/status";
import { date } from "@/ui/format";

/**
 * All bookings. Redesigned 2026-11-17; the request, its filters and the
 * server-side paging are exactly as before (`/api/bookings/list` with the same
 * query parameters). The Current/Cancelled tabs and the "Cancelled" filter are
 * one control now: Current, Cancelled, or All.
 */

interface BookingListProps {
    idProjectInvestmentBookings: number;
    bookingId: string;
    User: {
        fullName: string;
    },
    paymentConfirmationStatus: string;
    ProjectInvestors: {
        Project: {
            projectName: string;
        };
        unitPurchased: number;
        investmentDate: string;
        maturityDate: string;
        investmentStatus: string;
    }[];
    cancelled: string;
}

interface FilterProps {
    idProjectInvestmentBookings: string;
    bookingId: string;
    investorName: string;
    paymentConfirmationStatus: string;
    cancelled: string;
    orderBy: string;
    orderType: string;
    page: number;
    pageSize: number;
}

type Tab = "current" | "cancelled" | "all";

function List() {

    const [bookingList, setBookingList] = useState<BookingListProps[]>([]);
    const [filter, setFilter] = useState<FilterProps>({
        idProjectInvestmentBookings: '',
        bookingId: '',
        investorName: '',
        paymentConfirmationStatus: '',
        cancelled: 'no',
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
                const res = await fetch(`/api/bookings/list?${query}`, getRequestOptions());
                const data = await res.json();
                if (res.status === 200) {
                    setBookingList(data.data);
                    setTotal(data.total);
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: data.message,
                    });
                }
            } catch (err: any) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: err.message,
                });
            } finally {
                setLoading(false);
            }
        }
        fetchBookingList();
    }, [filter]);

    const handleInputOnChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFilter({
            ...filter,
            [name]: value,
            page: 1
        });
    }

    const tab: Tab = filter.cancelled === "yes" ? "cancelled" : filter.cancelled === "no" ? "current" : "all";
    const handleTabChange = (next: Tab) => {
        setFilter({
            ...filter,
            cancelled: next === "cancelled" ? "yes" : next === "current" ? "no" : "",
            page: 1,
        });
    };

    const totalPages = Math.max(1, Math.ceil(total / filter.pageSize));
    const handlePageChange = (page: number) => {
        setFilter({
            ...filter,
            page: Math.min(Math.max(1, page), totalPages)
        })
    }

    return (
        <div className="ui">
            <PageHeader
                eyebrow="Bookings"
                title="All bookings"
                description="Confirm payments, review proof and follow each booking to maturity."
                actions={
                    <LinkButton href="/bookings/create" variant="primary">
                        <Plus className="tw-h-4 tw-w-4" aria-hidden /> New booking
                    </LinkButton>
                }
            />

            <TableCard
                toolbar={
                    <div className="tw-flex tw-flex-col tw-gap-3">
                        <div className="tw-flex tw-flex-wrap tw-items-center tw-justify-between tw-gap-3">
                            <Segmented<Tab>
                                label="Which bookings"
                                value={tab}
                                onChange={handleTabChange}
                                options={[
                                    { value: "current", label: "Current" },
                                    { value: "cancelled", label: "Cancelled" },
                                    { value: "all", label: "All" },
                                ]}
                            />
                            <span className="tw-text-xs tw-tabular-nums tw-text-slate-500">{loading ? "Loading…" : `${total.toLocaleString("en-IN")} bookings`}</span>
                        </div>
                        <div className="tw-grid tw-grid-cols-2 tw-gap-3 md:tw-grid-cols-4">
                            <Field label="Booking ref">
                                <SearchInput placeholder="e.g. 000182" name="bookingId" onChange={handleInputOnChange} value={filter.bookingId} />
                            </Field>
                            <Field label="Investor">
                                <SearchInput placeholder="Name" name="investorName" onChange={handleInputOnChange} value={filter.investorName} />
                            </Field>
                            <Field label="Payment">
                                <Select name="paymentConfirmationStatus" onChange={handleInputOnChange} value={filter.paymentConfirmationStatus}>
                                    <option value="">All</option>
                                    <option value="pending">Pending</option>
                                    <option value="uploaded">Proof submitted (uploaded)</option>
                                    <option value="proof_submitted">Proof submitted</option>
                                    <option value="confirmed">Confirmed</option>
                                    <option value="denied">Denied</option>
                                </Select>
                            </Field>
                            <Field label="Internal #">
                                <Input type="number" placeholder="e.g. 372" name="idProjectInvestmentBookings" onChange={handleInputOnChange} value={filter.idProjectInvestmentBookings} />
                            </Field>
                        </div>
                    </div>
                }
                footer={
                    <Pager
                        page={filter.page}
                        totalPages={totalPages}
                        onChange={handlePageChange}
                        summary={total ? `Page ${filter.page} of ${totalPages}` : undefined}
                    />
                }
            >
                <thead>
                    <tr>
                        <th className={TH}>Booking</th>
                        <th className={TH}>Investor</th>
                        <th className={TH}>Payment</th>
                        <th className={TH}>Projects</th>
                        <th className={cx(TH, "tw-text-right")}>Units</th>
                        <th className={TH}>Term</th>
                        <th className={cx(TH, "tw-text-right")}><span className="tw-sr-only">Open</span></th>
                    </tr>
                </thead>
                <tbody className={cx(loading && "tw-opacity-60 tw-transition-opacity")}>
                    {bookingList.length > 0 ? bookingList.map((booking, index) => {
                        const pay = paymentStatus(booking.paymentConfirmationStatus, booking.cancelled);
                        return (
                            <tr key={index} className={TR}>
                                <td className={TD}>
                                    <Link href={`/bookings/details/${booking.idProjectInvestmentBookings}`} className="tw-font-semibold tw-tabular-nums tw-text-slate-900 hover:tw-text-brand-700">
                                        #{booking.bookingId || booking.idProjectInvestmentBookings}
                                    </Link>
                                    <span className="tw-block tw-text-xs tw-tabular-nums tw-text-slate-400">internal {booking.idProjectInvestmentBookings}</span>
                                </td>
                                <td className={cx(TD, "tw-font-medium tw-text-slate-800")}>{booking.User?.fullName}</td>
                                <td className={TD}>
                                    <Pill tone={pay.tone}>{pay.label}</Pill>
                                </td>
                                <td className={TD}>
                                    <ul className="tw-space-y-1.5">
                                        {booking.ProjectInvestors.map((invest, i) => {
                                            const st = investmentStatus(invest.investmentStatus);
                                            return (
                                                <li key={i} className="tw-flex tw-flex-wrap tw-items-center tw-gap-2">
                                                    <span className="tw-text-slate-800">{invest.Project?.projectName}</span>
                                                    <Pill tone={st.tone} dot={false}>{st.label}</Pill>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </td>
                                <td className={cx(TD, "tw-text-right tw-tabular-nums tw-text-slate-700")}>
                                    <ul className="tw-space-y-1.5">
                                        {booking.ProjectInvestors.map((invest, i) => (
                                            <li key={i}>{invest.unitPurchased}</li>
                                        ))}
                                    </ul>
                                </td>
                                <td className={cx(TD, "tw-whitespace-nowrap tw-tabular-nums tw-text-slate-600")}>
                                    <ul className="tw-space-y-1.5">
                                        {booking.ProjectInvestors.map((invest, i) => (
                                            <li key={i}>
                                                {date(invest.investmentDate)} <span className="tw-text-slate-300">→</span> {invest.maturityDate ? date(invest.maturityDate) : "—"}
                                            </li>
                                        ))}
                                    </ul>
                                </td>
                                <td className={cx(TD, "tw-text-right")}>
                                    <Link
                                        href={`/bookings/details/${booking.idProjectInvestmentBookings}`}
                                        className="tw-inline-flex tw-items-center tw-gap-1 tw-rounded-lg tw-px-2 tw-py-1 tw-text-xs tw-font-semibold tw-text-brand-700 hover:tw-bg-brand-50"
                                    >
                                        Details <ArrowUpRight className="tw-h-3.5 tw-w-3.5" aria-hidden />
                                    </Link>
                                </td>
                            </tr>
                        );
                    }) : (
                        <EmptyRow colSpan={7} title={loading ? "Loading bookings…" : "No bookings found"} hint={loading ? undefined : "Try another tab or fewer filters."} />
                    )}
                </tbody>
            </TableCard>
        </div>
    )

}

export default List;

List.getLayout = function PageLayout(page: any) {
    return (
        <MainLayout>
            {page}
        </MainLayout>
    )
}
