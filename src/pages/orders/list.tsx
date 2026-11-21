import React, { useState, useEffect } from "react";
import Link from "next/link";
import MainLayout from "@/layouts/MainLayout";
import { getRequestOptions } from "@/utils/Fetch";
import Swal from "sweetalert2";
import { ChevronRight } from "lucide-react";
import { Pill, cx } from "@/ui/primitives";
import { Field, Input, Select } from "@/ui/controls";
import { EmptyRow, PageHeader, TableCard, TD, TH, TR } from "@/ui/layout";
import { ListFooter, ListToolbar, SortTH, filterChips, useListState } from "@/ui/table";
import { bdtExact, date } from "@/ui/format";
import { ORDER_STATUSES, orderStatus } from "@/ui/status";

interface ListProps {
    idProductOrders: number,
    buyerName: string,
    buyerPhoneNumber: string,
    buyerEmail: string,
    districtName: string,
    policeStationName: string,
    orderAmount: number,
    orderId: string,
    orderStatus: string,
    specialInstructions: string,
    orderDate: string
}

const DEFAULTS = {
    q: '',
    status: '',
    area: '',
    orderAmount: '',
    orderDate: '',
    orderBy: 'createdAt',
    orderType: 'DESC' as 'ASC' | 'DESC',
    page: 1,
    pageSize: 25,
};

/**
 * Orders: one search box (order ID, buyer's name, phone or email, or the order
 * number), filters with chips, sortable columns, rows per page; the view is
 * kept in the URL.
 */
function List() {
    const list = useListState(DEFAULTS);
    const { state, update } = list;
    const [orderList, setOrderList] = useState<ListProps[]>([]);
    const [total, setTotal] = useState<number>(0);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        if (!list.ready) return;
        let live = true;
        const fetchOrderList = async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/orders?${list.query}`, getRequestOptions());
                const data = await res.json();
                if (!live) return;
                if (res.status === 200) {
                    setOrderList(data.data);
                    setTotal(Number(data.total) || 0);
                } else {
                    Swal.fire({ icon: 'error', title: 'Error', text: data.message });
                }
            } catch (err: any) {
                if (live) Swal.fire({ icon: 'error', title: 'Error', text: err.message });
            } finally {
                if (live) setLoading(false);
            }
        }
        fetchOrderList();
        return () => {
            live = false;
        };
    }, [list.query, list.ready]);

    const chips = filterChips(state, list.defaults, {
        status: (v) => `Status: ${orderStatus(v).label}`,
        area: 'Area',
        orderAmount: 'Amount',
        orderDate: 'Date',
    }, update);
    const anyFilter = chips.length > 0 || state.q !== '';

    return (
        <div className="ui">
            <PageHeader eyebrow="Shathi Mart" title="Orders" description="Orders placed in the Mart, newest first. Open one to move it along: confirm, ship, deliver, mark paid." />

            <TableCard
                toolbar={
                    <ListToolbar
                        search={state.q}
                        onSearch={(q) => update({ q }, { typing: true })}
                        placeholder="Order ID, buyer name, phone or email"
                        chips={chips}
                        onReset={() => list.reset()}
                        filters={
                            <>
                                <Field label="Status">
                                    <Select {...list.bind('status')}>
                                        <option value="">All</option>
                                        {ORDER_STATUSES.map((s) => (
                                            <option key={s.value} value={s.value}>
                                                {s.label}
                                            </option>
                                        ))}
                                    </Select>
                                </Field>
                                <Field label="Area">
                                    <Input placeholder="District or thana" {...list.bind('area')} />
                                </Field>
                                <Field label="Amount">
                                    <Input placeholder="e.g. 1500" {...list.bind('orderAmount')} />
                                </Field>
                                <Field label="Date" hint="A day or a month">
                                    <Input placeholder="e.g. 2026-11" {...list.bind('orderDate')} />
                                </Field>
                            </>
                        }
                    />
                }
                footer={<ListFooter page={state.page} pageSize={state.pageSize} total={total} loading={loading} noun="orders" onPage={(page) => update({ page })} onPageSize={(pageSize) => update({ pageSize })} />}
            >
                <thead>
                    <tr>
                        <SortTH label="Order" field="createdAt" sort={state} onSort={list.sortBy} />
                        <SortTH label="Buyer" field="buyerName" sort={state} onSort={list.sortBy} className="tw-min-w-[14rem]" />
                        <th className={TH}>Area</th>
                        <SortTH label="Amount" field="orderAmount" sort={state} onSort={list.sortBy} align="right" />
                        <SortTH label="Status" field="status" sort={state} onSort={list.sortBy} />
                        <th className={cx(TH, 'tw-text-right')}>
                            <span className="tw-sr-only">Open</span>
                        </th>
                    </tr>
                </thead>
                <tbody className={cx(loading && 'tw-opacity-60 tw-transition-opacity')}>
                    {orderList.length > 0 ? orderList.map((order) => {
                        const status = orderStatus(order.orderStatus);
                        return (
                            <tr key={order.idProductOrders} className={TR}>
                                <td className={cx(TD, 'tw-whitespace-nowrap')}>
                                    <Link href={`/orders/details/${order.idProductOrders}`} className="tw-font-semibold tw-tabular-nums tw-text-slate-900 hover:tw-text-brand-700">
                                        {order.orderId}
                                    </Link>
                                    <div className="tw-text-xs tw-tabular-nums tw-text-slate-500">{order.orderDate ? date(String(order.orderDate)) : '—'} · #{order.idProductOrders}</div>
                                </td>
                                <td className={TD}>
                                    <div className="tw-font-medium tw-text-slate-900">{order.buyerName}</div>
                                    <div className="tw-text-xs tw-text-slate-500">
                                        {[order.buyerPhoneNumber, order.buyerEmail].filter(Boolean).join(' · ')}
                                    </div>
                                </td>
                                <td className={cx(TD, 'tw-text-slate-600')}>{[order.districtName, order.policeStationName].filter(Boolean).join(', ') || '—'}</td>
                                <td className={cx(TD, 'tw-whitespace-nowrap tw-text-right tw-font-medium tw-tabular-nums tw-text-slate-900')}>{bdtExact(Number(order.orderAmount))}</td>
                                <td className={TD}><Pill tone={status.tone}>{status.label}</Pill></td>
                                <td className={cx(TD, 'tw-text-right')}>
                                    <Link
                                        href={`/orders/details/${order.idProductOrders}`}
                                        className="tw-inline-flex tw-h-8 tw-w-8 tw-items-center tw-justify-center tw-rounded-lg tw-text-slate-400 hover:tw-bg-slate-100 hover:tw-text-slate-700"
                                        aria-label={`Open order ${order.orderId}`}
                                    >
                                        <ChevronRight className="tw-h-4 tw-w-4" aria-hidden />
                                    </Link>
                                </td>
                            </tr>
                        );
                    }) : (
                        <EmptyRow colSpan={6} title={loading ? 'Loading orders…' : 'No orders match'} hint={!loading && anyFilter ? 'Try fewer filters.' : undefined} />
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
