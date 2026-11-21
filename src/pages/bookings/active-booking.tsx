import React, { useState, useEffect } from "react";
import MainLayout from "@/layouts/MainLayout";
import Swal from "sweetalert2";
import Link from "next/link";
import { ArrowUpRight, Repeat2 } from "lucide-react";
import { getRequestOptions } from "@/utils/Fetch";
import { Pill, Segmented, cx } from "@/ui/primitives";
import { Field, Select } from "@/ui/controls";
import { EmptyRow, PageHeader, TableCard, TD, TH, TR } from "@/ui/layout";
import { ListFooter, ListToolbar, SortTH, useListState, type FilterChip } from "@/ui/table";
import { bdt, date } from "@/ui/format";

/**
 * Active bookings: every investment with money working, soonest to mature
 * first. Tabs for what has matured (including lines already marked ready for
 * withdrawal) and what matures within 30 days; a matured line has a Reinvest
 * button that opens the reinvest dialog on its booking.
 */

interface BookingListProps {
    idProjectInvestors: number;
    investmentStatus: string;
    Project: {
        idProjects: number;
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
            phoneNumber?: string | null;
        };
    };
    idProjectInvestmentBookings: number;
    investmentDate: string;
    unitPurchased: number;
    capital: number;
    totalReturnMin: number;
    totalReturnMax: number;
    maturityDate: string;
    remainingDays: number | null;
    remainingTimeFormatted: string;
    matured: boolean;
    waiting: boolean;
}

type Stage = "" | "matured" | "due30" | "running";
type Counts = { all: number; running: number; due30: number; matured: number };

const DEFAULTS = {
    q: "",
    stage: "" as Stage,
    idProjects: "",
    orderBy: "maturity",
    orderType: "ASC" as "ASC" | "DESC",
    page: 1,
    pageSize: 25,
};

function ActiveBooking() {
    const list = useListState(DEFAULTS);
    const { state, update } = list;
    const [bookingList, setBookingList] = useState<BookingListProps[]>([]);
    const [total, setTotal] = useState<number>(0);
    const [counts, setCounts] = useState<Counts | null>(null);
    const [projects, setProjects] = useState<{ idProjects: number; projectName: string }[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        if (!list.ready) return;
        let live = true;
        const fetchBookingList = async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/bookings/active-booking?${list.query}`, getRequestOptions());
                const data = await res.json();
                if (!live) return;
                if (res.status === 200) {
                    setBookingList(data.data);
                    setTotal(data.total);
                    setCounts(data.counts ?? null);
                    setProjects(data.projects ?? []);
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

    const chips: FilterChip[] = [];
    if (state.idProjects) {
        chips.push({ label: `Project: ${projects.find((p) => String(p.idProjects) === state.idProjects)?.projectName ?? state.idProjects}`, onClear: () => update({ idProjects: "" }) });
    }

    return (
        <div className="ui">
            <PageHeader
                eyebrow="Bookings"
                title="Active bookings"
                description="Every investment with money working, its expected return and time to maturity. Matured ones can be reinvested from here."
            />

            <TableCard
                toolbar={
                    <ListToolbar
                        left={
                            <Segmented<Stage>
                                label="Which investments"
                                value={state.stage}
                                onChange={(stage) => update({ stage })}
                                options={[
                                    { value: "", label: "All active", count: counts?.all },
                                    { value: "matured", label: "Matured", count: counts?.matured },
                                    { value: "due30", label: "Due in 30 days", count: counts?.due30 },
                                    { value: "running", label: "Running", count: counts?.running },
                                ]}
                            />
                        }
                        search={state.q}
                        onSearch={(q) => update({ q }, { typing: true })}
                        placeholder="Ref, investor, phone or project"
                        chips={chips}
                        onReset={() => list.reset({ stage: state.stage })}
                        filters={
                            <Field label="Project">
                                <Select value={state.idProjects} onChange={(e) => update({ idProjects: e.target.value })}>
                                    <option value="">Any project</option>
                                    {projects.map((p) => (
                                        <option key={p.idProjects} value={p.idProjects}>{p.projectName}</option>
                                    ))}
                                </Select>
                            </Field>
                        }
                    />
                }
                footer={<ListFooter page={state.page} pageSize={state.pageSize} total={total} loading={loading} noun="investments" onPage={(page) => update({ page })} onPageSize={(pageSize) => update({ pageSize })} />}
            >
                <thead>
                    <tr>
                        <SortTH label="Booking" field="booking" sort={state} onSort={list.sortBy} />
                        <SortTH label="Project" field="project" sort={state} onSort={list.sortBy} />
                        <SortTH label="Amount" field="amount" sort={state} onSort={list.sortBy} align="right" />
                        <th className={cx(TH, "tw-text-right")}>Returnable</th>
                        <SortTH label="Term" field="start" sort={state} onSort={list.sortBy} />
                        <SortTH label="Remaining" field="maturity" sort={state} onSort={list.sortBy} />
                        <th className={TH}><span className="tw-sr-only">Actions</span></th>
                    </tr>
                </thead>
                <tbody className={cx(loading && "tw-opacity-60 tw-transition-opacity")}>
                    {bookingList.length > 0 ? bookingList.map((b) => {
                        const { Project: p, ProjectInvestmentBooking: pib } = b;
                        const href = `/bookings/details/${b.idProjectInvestmentBookings}`;
                        return (
                            <tr key={b.idProjectInvestors} className={cx(TR, b.matured && "tw-bg-emerald-50/40")}>
                                <td className={TD}>
                                    <Link href={href} className="tw-font-semibold tw-tabular-nums tw-text-slate-900 hover:tw-text-brand-700">
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
                                <td className={cx(TD, "tw-whitespace-nowrap tw-text-right tw-font-semibold tw-tabular-nums tw-text-slate-900")}>{bdt(b.capital)}</td>
                                <td className={cx(TD, "tw-whitespace-nowrap tw-text-right tw-tabular-nums tw-text-emerald-700")}>
                                    {bdt(b.totalReturnMin)}–{bdt(b.totalReturnMax).replace("৳", "")}
                                </td>
                                <td className={cx(TD, "tw-whitespace-nowrap tw-tabular-nums tw-text-slate-600")}>
                                    {date(pib?.paymentDate)} <span className="tw-text-slate-300">→</span> {b.maturityDate !== '-' ? date(b.maturityDate) : '—'}
                                    <span className="tw-block tw-text-xs tw-text-slate-400">{p?.tenure ? `${p.duration} ${p.tenure}` : "—"}</span>
                                </td>
                                <td className={cx(TD, "tw-whitespace-nowrap tw-text-slate-700")}>
                                    {b.waiting ? (
                                        <Pill tone="amber">Ready for withdrawal</Pill>
                                    ) : b.matured ? (
                                        <Pill tone="green">Matured</Pill>
                                    ) : b.remainingDays !== null && b.remainingDays <= 30 ? (
                                        <span className="tw-font-medium tw-text-amber-700">{b.remainingTimeFormatted}</span>
                                    ) : (
                                        b.remainingTimeFormatted
                                    )}
                                </td>
                                <td className={cx(TD, "tw-whitespace-nowrap tw-text-right")}>
                                    {b.matured && (
                                        <Link
                                            href={`${href}?reinvest=${b.idProjectInvestors}`}
                                            className="tw-mr-1 tw-inline-flex tw-items-center tw-gap-1 tw-rounded-lg tw-bg-brand-700 tw-px-2.5 tw-py-1 tw-text-xs tw-font-semibold tw-text-white hover:tw-bg-brand-600"
                                        >
                                            <Repeat2 className="tw-h-3.5 tw-w-3.5" aria-hidden /> Reinvest
                                        </Link>
                                    )}
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
                        <EmptyRow
                            colSpan={7}
                            title={loading ? "Loading investments…" : state.stage === "matured" ? "Nothing has matured" : "No active investments found"}
                            hint={loading ? undefined : state.q || state.idProjects ? "Try other words or fewer filters." : undefined}
                        />
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
