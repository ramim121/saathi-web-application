import React, { useState, useEffect } from "react";
import MainLayout from "@/layouts/MainLayout";
import Swal from "sweetalert2";
import Link from "next/link";
import { ArrowUpRight, Plus, Repeat2 } from "lucide-react";
import { getRequestOptions } from "@/utils/Fetch";
import { Pill, Segmented, cx } from "@/ui/primitives";
import { Field, LinkButton, Select } from "@/ui/controls";
import { EmptyRow, PageHeader, TableCard, TD, TH, TR } from "@/ui/layout";
import { ListFooter, ListToolbar, SortTH, useListState, type FilterChip } from "@/ui/table";
import { investmentStatus, paymentStatus } from "@/ui/status";
import { date, daysFromToday } from "@/ui/format";
import { dhakaStamp } from "@/ui/status";
import { REVIEW_FLAG_HOURS, formatDue, hoursSince, timeLeft } from "@/utils/bookingHoldsShared";

/**
 * All bookings: one search box (ref, internal number, investor name, phone or
 * email, project), filters for payment and type, sortable columns, and the
 * list's state in the URL so Back from a booking returns to the same view.
 * A matured line links straight to its reinvest dialog.
 */

interface BookingListProps {
    idProjectInvestmentBookings: number;
    bookingId: string;
    bookingType?: string;
    createdAt?: string;
    User: {
        fullName: string;
    },
    paymentConfirmationStatus: string;
    /** End of the payment window (UTC) and the derived state, from the API. */
    paymentDueAt?: string | null;
    state?: string;
    receiptSubmittedAt?: string | null;
    ProjectInvestors: {
        idProjectInvestors: number;
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

type Tab = "current" | "cancelled" | "all";

const PAYMENT_OPTIONS: [string, string][] = [
    ["pending", "Awaiting payment"],
    ["proof_submitted", "Proof submitted"],
    ["uploaded", "Proof submitted (older app)"],
    ["confirmed", "Confirmed"],
    ["denied", "Denied"],
];

const HOLD_OPTIONS: [string, string][] = [
    ["expiring_24h", "Expiring in 24 h"],
    ["expired", "Expired"],
    ["review", "Receipt under review"],
    ["review_48h", `Receipt waiting over ${REVIEW_FLAG_HOURS} h`],
];

const DEFAULTS = {
    q: "",
    paymentConfirmationStatus: "",
    hold: "",
    bookingType: "",
    cancelled: "no",
    orderBy: "idProjectInvestmentBookings",
    orderType: "DESC" as "ASC" | "DESC",
    page: 1,
    pageSize: 25,
};

const MATURED_OPEN = ["ready_for_withdrawal", "request_withdrawal"];

function List() {
    const list = useListState(DEFAULTS);
    const { state, update } = list;
    const [bookingList, setBookingList] = useState<BookingListProps[]>([]);
    const [total, setTotal] = useState<number>(0);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        if (!list.ready) return;
        let live = true;
        const fetchBookingList = async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/bookings/list?${list.query}`, getRequestOptions());
                const data = await res.json();
                if (!live) return;
                if (res.status === 200) {
                    setBookingList(data.data);
                    setTotal(data.total);
                } else {
                    Swal.fire({ icon: 'error', title: 'Error', text: data.message });
                }
            } catch (err: any) {
                if (live) Swal.fire({ icon: 'error', title: 'Error', text: err.message });
            } finally {
                if (live) setLoading(false);
            }
        };
        fetchBookingList();
        return () => {
            live = false;
        };
    }, [list.query, list.ready]);

    const tab: Tab = state.cancelled === "yes" ? "cancelled" : state.cancelled === "no" ? "current" : "all";
    const chips: FilterChip[] = [];
    if (state.paymentConfirmationStatus) {
        chips.push({ label: `Payment: ${PAYMENT_OPTIONS.find(([v]) => v === state.paymentConfirmationStatus)?.[1] ?? state.paymentConfirmationStatus}`, onClear: () => update({ paymentConfirmationStatus: "" }) });
    }
    if (state.hold) {
        chips.push({ label: HOLD_OPTIONS.find(([v]) => v === state.hold)?.[1] ?? state.hold, onClear: () => update({ hold: "" }) });
    }
    if (state.bookingType) {
        chips.push({ label: state.bookingType === "reinvestment" ? "Reinvestments only" : "New money only", onClear: () => update({ bookingType: "" }) });
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
                    <ListToolbar
                        left={
                            <Segmented<Tab>
                                label="Which bookings"
                                value={tab}
                                onChange={(next) => update({ cancelled: next === "cancelled" ? "yes" : next === "current" ? "no" : "" })}
                                options={[
                                    { value: "current", label: "Current" },
                                    { value: "cancelled", label: "Cancelled" },
                                    { value: "all", label: "All" },
                                ]}
                            />
                        }
                        search={state.q}
                        onSearch={(q) => update({ q }, { typing: true })}
                        placeholder="Ref, investor, phone, email or project"
                        chips={chips}
                        onReset={() => list.reset({ cancelled: state.cancelled })}
                        filters={
                            <>
                                <Field label="Payment">
                                    <Select value={state.paymentConfirmationStatus} onChange={(e) => update({ paymentConfirmationStatus: e.target.value })}>
                                        <option value="">Any</option>
                                        {PAYMENT_OPTIONS.map(([v, l]) => (
                                            <option key={v} value={v}>{l}</option>
                                        ))}
                                    </Select>
                                </Field>
                                <Field label="Payment deadline">
                                    {/* Expired bookings may already be cancelled by the job, so that filter looks at every tab. */}
                                    <Select value={state.hold} onChange={(e) => update(e.target.value === "expired" ? { hold: e.target.value, cancelled: "" } : { hold: e.target.value })}>
                                        <option value="">Any</option>
                                        {HOLD_OPTIONS.map(([v, l]) => (
                                            <option key={v} value={v}>{l}</option>
                                        ))}
                                    </Select>
                                </Field>
                                <Field label="Type">
                                    <Select value={state.bookingType} onChange={(e) => update({ bookingType: e.target.value })}>
                                        <option value="">Any</option>
                                        <option value="fresh">New money</option>
                                        <option value="reinvestment">Reinvestment</option>
                                    </Select>
                                </Field>
                            </>
                        }
                    />
                }
                footer={<ListFooter page={state.page} pageSize={state.pageSize} total={total} loading={loading} noun="bookings" onPage={(page) => update({ page })} onPageSize={(pageSize) => update({ pageSize })} />}
            >
                <thead>
                    <tr>
                        <SortTH label="Booking" field="idProjectInvestmentBookings" sort={state} onSort={list.sortBy} />
                        <th className={TH}>Investor</th>
                        <SortTH label="Payment" field="paymentConfirmationStatus" sort={state} onSort={list.sortBy} />
                        <th className={TH}>Projects</th>
                        <th className={cx(TH, "tw-text-right")}>Units</th>
                        <th className={TH}>Term</th>
                        <SortTH label="Booked" field="createdAt" sort={state} onSort={list.sortBy} />
                        <th className={cx(TH, "tw-text-right")}><span className="tw-sr-only">Open</span></th>
                    </tr>
                </thead>
                <tbody className={cx(loading && "tw-opacity-60 tw-transition-opacity")}>
                    {bookingList.length > 0 ? bookingList.map((booking) => {
                        const pay = paymentStatus(booking.paymentConfirmationStatus, booking.cancelled);
                        const href = `/bookings/details/${booking.idProjectInvestmentBookings}`;
                        return (
                            <tr key={booking.idProjectInvestmentBookings} className={TR}>
                                <td className={TD}>
                                    <Link href={href} className="tw-font-semibold tw-tabular-nums tw-text-slate-900 hover:tw-text-brand-700">
                                        #{booking.bookingId || booking.idProjectInvestmentBookings}
                                    </Link>
                                    <span className="tw-block tw-text-xs tw-tabular-nums tw-text-slate-400">internal {booking.idProjectInvestmentBookings}</span>
                                    {booking.bookingType === "reinvestment" && (
                                        <span className="tw-mt-1 tw-inline-block">
                                            <Pill tone="violet" dot={false}>Reinvestment</Pill>
                                        </span>
                                    )}
                                </td>
                                <td className={cx(TD, "tw-font-medium tw-text-slate-800")}>{booking.User?.fullName}</td>
                                <td className={TD}>
                                    <Pill tone={pay.tone}>{pay.label}</Pill>
                                    <HoldNote booking={booking} />
                                </td>
                                <td className={TD}>
                                    <ul className="tw-space-y-1.5">
                                        {booking.ProjectInvestors.map((invest) => {
                                            const st = investmentStatus(invest.investmentStatus);
                                            const matured =
                                                booking.cancelled !== "yes" &&
                                                booking.paymentConfirmationStatus === "confirmed" &&
                                                (MATURED_OPEN.includes(invest.investmentStatus) ||
                                                    (invest.investmentStatus === "confirmed" && Boolean(invest.maturityDate) && daysFromToday(invest.maturityDate) <= 0));
                                            return (
                                                <li key={invest.idProjectInvestors} className="tw-flex tw-flex-wrap tw-items-center tw-gap-2">
                                                    <span className="tw-text-slate-800">{invest.Project?.projectName}</span>
                                                    <Pill tone={st.tone} dot={false}>{st.label}</Pill>
                                                    {matured && (
                                                        <Link
                                                            href={`${href}?reinvest=${invest.idProjectInvestors}`}
                                                            className="tw-inline-flex tw-items-center tw-gap-1 tw-rounded-full tw-bg-emerald-50 tw-px-2 tw-py-0.5 tw-text-[11px] tw-font-semibold tw-text-emerald-800 tw-ring-1 tw-ring-emerald-200 hover:tw-bg-emerald-100"
                                                        >
                                                            <Repeat2 className="tw-h-3 tw-w-3" aria-hidden /> Matured · Reinvest
                                                        </Link>
                                                    )}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </td>
                                <td className={cx(TD, "tw-text-right tw-tabular-nums tw-text-slate-700")}>
                                    <ul className="tw-space-y-1.5">
                                        {booking.ProjectInvestors.map((invest) => (
                                            <li key={invest.idProjectInvestors}>{invest.unitPurchased}</li>
                                        ))}
                                    </ul>
                                </td>
                                <td className={cx(TD, "tw-whitespace-nowrap tw-tabular-nums tw-text-slate-600")}>
                                    <ul className="tw-space-y-1.5">
                                        {booking.ProjectInvestors.map((invest) => (
                                            <li key={invest.idProjectInvestors}>
                                                {date(invest.investmentDate)} <span className="tw-text-slate-300">→</span> {invest.maturityDate ? date(invest.maturityDate) : "—"}
                                            </li>
                                        ))}
                                    </ul>
                                </td>
                                <td className={cx(TD, "tw-whitespace-nowrap tw-text-xs tw-tabular-nums tw-text-slate-500")}>{booking.createdAt ? dhakaStamp(booking.createdAt) : "—"}</td>
                                <td className={cx(TD, "tw-text-right")}>
                                    <Link
                                        href={href}
                                        className="tw-inline-flex tw-items-center tw-gap-1 tw-rounded-lg tw-px-2 tw-py-1 tw-text-xs tw-font-semibold tw-text-brand-700 hover:tw-bg-brand-50"
                                    >
                                        Details <ArrowUpRight className="tw-h-3.5 tw-w-3.5" aria-hidden />
                                    </Link>
                                </td>
                            </tr>
                        );
                    }) : (
                        <EmptyRow colSpan={8} title={loading ? "Loading bookings…" : "No bookings found"} hint={loading ? undefined : "Try another tab, other words, or fewer filters."} />
                    )}
                </tbody>
            </TableCard>
        </div>
    )

}

/** Under the payment pill: the deadline, or how long a receipt has waited. */
function HoldNote({ booking }: { booking: BookingListProps }) {
    if (booking.state === "expired") {
        return <span className="tw-mt-1 tw-block tw-text-xs tw-font-semibold tw-text-rose-700">Expired{booking.paymentDueAt ? ` ${formatDue(booking.paymentDueAt)}` : ""}</span>;
    }
    if ((booking.state === "awaiting_payment" || booking.state === "receipt_rejected") && booking.paymentDueAt) {
        const left = timeLeft(booking.paymentDueAt);
        const soon = new Date(booking.paymentDueAt).getTime() - Date.now() <= 24 * 3600 * 1000;
        return (
            <span className={cx("tw-mt-1 tw-block tw-whitespace-nowrap tw-text-xs tw-tabular-nums", soon ? "tw-font-semibold tw-text-amber-700" : "tw-text-slate-500")}>
                Pay by {formatDue(booking.paymentDueAt)}{left ? ` · ${left} left` : ""}
            </span>
        );
    }
    if (booking.state === "under_review" && booking.receiptSubmittedAt) {
        const hours = hoursSince(booking.receiptSubmittedAt);
        return (
            <span className={cx("tw-mt-1 tw-block tw-whitespace-nowrap tw-text-xs tw-tabular-nums", hours >= REVIEW_FLAG_HOURS ? "tw-font-semibold tw-text-rose-700" : "tw-text-slate-500")}>
                Waiting {hours >= 48 ? `${Math.floor(hours / 24)} days` : `${hours} h`}
            </span>
        );
    }
    return null;
}

export default List;

List.getLayout = function PageLayout(page: any) {
    return (
        <MainLayout>
            {page}
        </MainLayout>
    )
}
