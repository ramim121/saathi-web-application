import React, { useState, useEffect } from "react";
import Link from "next/link";
import MainLayout from "@/layouts/MainLayout";
import { getRequestOptions } from "@/utils/Fetch";
import Swal from "sweetalert2";
import { ChevronRight, X } from "lucide-react";
import { Pill, cx } from "@/ui/primitives";
import { Button, Field, Input, SearchInput, Select } from "@/ui/controls";
import { EmptyRow, PageHeader, Pager, TableCard, TD, TH, TR } from "@/ui/layout";
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

interface FilterProps {
    idProductOrders: string,
    orderId: string,
    buyer: string,
    area: string,
    orderAmount: string,
    orderDate: string,
    status: string,
    orderBy: string,
    orderType: string,
    page: number,
    pageSize: number
}

const INITIAL_FILTER: FilterProps = {
    idProductOrders: '',
    orderId: '',
    buyer: '',
    area: '',
    orderAmount: '',
    orderDate: '',
    status: '',
    orderBy: 'idProductOrders',
    orderType: 'DESC',
    page: 1,
    pageSize: 10
};

function List() {
    const [orderList, setOrderList] = useState<ListProps[]>([]);
    const [filter, setFilter] = useState<FilterProps>(INITIAL_FILTER);
    const [total, setTotal] = useState<number>(0);
    const [totalPages, setTotalPages] = useState<number>(1);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        const fetchOrderList = async () => {
            const query = new URLSearchParams(filter as any).toString();
            setLoading(true);
            try {
                const res = await fetch(`/api/orders?${query}`, getRequestOptions());
                const data = await res.json();
                if (res.status === 200) {
                    setOrderList(data.data);
                    setTotal(data.total);
                    setTotalPages(data.totalPages);
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
        fetchOrderList();
    }, [filter]);

    // A changed filter starts again from page 1.
    const handleInputOnChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFilter({
            ...filter,
            [name]: value,
            page: 1
        });
    }

    const pages = Math.max(1, totalPages || 1);
    const handlePageChange = (page: number) => {
        setFilter({
            ...filter,
            page: Math.min(Math.max(1, page), pages)
        })
    }

    const anyFilter = Boolean(filter.idProductOrders || filter.orderId || filter.buyer || filter.area || filter.orderAmount || filter.orderDate || filter.status);

    return (
        <div className="ui">
            <PageHeader eyebrow="Shathi Mart" title="Orders" description="Orders placed in the Mart, newest first. Open one to move it along: confirm, ship, deliver, mark paid." />

            <TableCard
                toolbar={
                    <div className="tw-flex tw-flex-col tw-gap-3">
                        <div className="tw-grid tw-grid-cols-2 tw-gap-3 md:tw-grid-cols-4 xl:tw-grid-cols-[1.2fr_1.6fr_1.2fr_1fr_1fr_1fr_auto]">
                            <Field label="Order ID">
                                <SearchInput placeholder="e.g. ORD-…" name="orderId" onChange={handleInputOnChange} value={filter.orderId} />
                            </Field>
                            <Field label="Buyer">
                                <Input placeholder="Name, phone or email" name="buyer" onChange={handleInputOnChange} value={filter.buyer} />
                            </Field>
                            <Field label="Area">
                                <Input placeholder="District or thana" name="area" onChange={handleInputOnChange} value={filter.area} />
                            </Field>
                            <Field label="Status">
                                <Select name="status" onChange={handleInputOnChange} value={filter.status}>
                                    <option value="">All</option>
                                    {ORDER_STATUSES.map((s) => (
                                        <option key={s.value} value={s.value}>
                                            {s.label}
                                        </option>
                                    ))}
                                </Select>
                            </Field>
                            <Field label="Amount">
                                <Input placeholder="e.g. 1500" name="orderAmount" onChange={handleInputOnChange} value={filter.orderAmount} />
                            </Field>
                            <Field label="Date">
                                <Input placeholder="e.g. 2026-11" name="orderDate" onChange={handleInputOnChange} value={filter.orderDate} />
                            </Field>
                            <div className="tw-col-span-2 tw-flex tw-items-end md:tw-col-span-4 xl:tw-col-span-1">
                                {anyFilter && (
                                    <Button variant="ghost" onClick={() => setFilter({ ...INITIAL_FILTER, pageSize: filter.pageSize })}>
                                        <X className="tw-h-4 tw-w-4" aria-hidden /> Clear
                                    </Button>
                                )}
                            </div>
                        </div>
                        <p className="tw-text-xs tw-tabular-nums tw-text-slate-500">{loading ? 'Loading…' : `${Number(total || 0).toLocaleString('en-IN')} orders`}</p>
                    </div>
                }
                footer={<Pager page={filter.page} totalPages={pages} onChange={handlePageChange} summary={total ? `Page ${filter.page} of ${pages}` : undefined} />}
            >
                <thead>
                    <tr>
                        <th className={TH}>Order</th>
                        <th className={cx(TH, 'tw-min-w-[14rem]')}>Buyer</th>
                        <th className={TH}>Area</th>
                        <th className={cx(TH, 'tw-text-right')}>Amount</th>
                        <th className={TH}>Status</th>
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
