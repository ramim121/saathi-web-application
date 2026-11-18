/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect } from "react";
import Link from "next/link";
import MainLayout from "@/layouts/MainLayout";
import { useRouter } from "next/router";
import { getRequestOptions, postRequestOptions } from "@/utils/Fetch";
import { API_URL } from '@/config/public';
import Swal from "sweetalert2";
import { ArrowLeft, MapPin, MessageSquareText, ShoppingBag, UserRound } from "lucide-react";
import { Card, Pill, Skeleton, cx } from "@/ui/primitives";
import { Button } from "@/ui/controls";
import { TableCard, TD, TH, TR } from "@/ui/layout";
import { bdtExact } from "@/ui/format";
import { dhakaStamp, orderStatus, words } from "@/ui/status";

interface DetailsProps {
    idProductOrders: number,
    orderId: string,
    orderAmount: number,
    createdAt: string,
    orderStatus: string,
    specialInstructions: string,
    OrderedBy: {
        fullName: string,
        email: string,
        phoneNumber: string
    },
    UserAddress: {
        District: {
            name: string,
            idDistricts: number
        },
        PoliceStation: {
            name: string,
            idPoliceStations: number
        },
        phone: string,
        receiverName: string,
        addressType: string,
        addressLine1: string,
        addressLine2: string,
        postalCode: string
    },
    ProductOrderItems: {
        Product: {
            productName: string,
            productDescription: string,
            ProductCategory: {
                productCategoryName: string,
            },
            Unit: {
                unitName: string,
                unitCode: string,
            },
        },
        ProductPartner: {
            User: {
                fullName: string,
                email: string,
                phoneNumber: string
            },
            ProductPacking: {
                packingName: string
            }
        },
        rate: number,
        quantity: number
    }[]
}

function Details() {
    const router = useRouter();
    const { id } = router.query;
    const [details, setDetails] = useState<DetailsProps>({} as DetailsProps);
    const [reload, setReload] = useState<boolean>(false)

    useEffect(() => {
        if (id != undefined) {
            fetchOrderDetails();
        }
    }, [id])

    useEffect(() => {
        if (reload) {
            fetchOrderDetails();
        }
    }, [reload])

    const fetchOrderDetails = async () => {
        try {
            const res = await fetch('/api/orders/' + id, getRequestOptions());
            const data = await res.json();
            if (res.status === 200) {
                setDetails(data.data);
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
        }
        setReload(false);
    }

    const orderStatusChange = async (status: string) => {
        Swal.fire({
            title: 'Are you sure?',
            text: "You want to change status of this order!",
            icon: 'warning',
            showCancelButton: true,
            cancelButtonText: 'No',
            confirmButtonText: 'Yes'
        }).then((result) => {
            if (result.value) {
                try {
                    const fetchData = async () => {
                        const res = await fetch(API_URL + 'api/orders/status_change', postRequestOptions({ idProductOrders: id, status: status }));
                        if (res.status === 200) {
                            Swal.fire({
                                icon: 'success',
                                title: 'Success',
                                text: 'Order status changed successfully!',
                            });
                            setReload(true);
                        } else {
                            Swal.fire({
                                icon: 'error',
                                title: 'Error',
                                html: (await res.json()).message,
                            });
                        }
                    };
                    fetchData();
                } catch (err) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: 'Something went wrong!',
                    });
                }
            }
        });
    }

    /** The next steps an order can take from each status — unchanged. */
    const orderStatusActions = {
        placed: [
            { label: "Confirmed", variant: "primary", nextStatus: "confirmed" },
            { label: "Cancelled", variant: "danger", nextStatus: "cancelled" }
        ],
        confirmed: [
            { label: "Shipped", variant: "primary", nextStatus: "shipped" },
            { label: "Cancelled", variant: "danger", nextStatus: "cancelled" }
        ],
        shipped: [
            { label: "Delivered", variant: "primary", nextStatus: "delivered" },
            { label: "Cancelled", variant: "danger", nextStatus: "cancelled" }
        ],
        delivered: [
            { label: "Paid", variant: "primary", nextStatus: "paid" },
            { label: "Returned", variant: "danger", nextStatus: "returned" }
        ]
    };

    const actions = orderStatusActions[details?.orderStatus as keyof typeof orderStatusActions] || [];
    const loaded = Boolean(details.idProductOrders);
    const status = orderStatus(details.orderStatus);
    const items = details.ProductOrderItems ?? [];
    const grandTotal = items.reduce((acc: number, item: any) => acc + (item?.rate * item?.quantity), 0);
    const address = details.UserAddress;

    return (
        <div className="ui">
            <Link href="/orders/list" className="tw-mb-3 tw-inline-flex tw-items-center tw-gap-1.5 tw-text-sm tw-font-medium tw-text-slate-500 hover:tw-text-slate-900">
                <ArrowLeft className="tw-h-4 tw-w-4" aria-hidden /> Orders
            </Link>

            <div className="tw-mb-6 tw-flex tw-flex-wrap tw-items-start tw-justify-between tw-gap-4">
                <div className="tw-min-w-0">
                    <p className="tw-text-xs tw-font-semibold tw-uppercase tw-tracking-[0.14em] tw-text-brand-700">Order</p>
                    {loaded ? (
                        <h1 className="tw-mt-1 tw-text-[26px] tw-font-semibold tw-leading-8 tw-tracking-tight tw-text-slate-900">{details.orderId}</h1>
                    ) : (
                        <Skeleton className="tw-mt-2 tw-h-7 tw-w-48" />
                    )}
                    {loaded && (
                        <div className="tw-mt-2 tw-flex tw-flex-wrap tw-items-center tw-gap-2">
                            <Pill tone={status.tone}>{status.label}</Pill>
                            <span className="tw-text-xs tw-text-slate-500">Placed {dhakaStamp(details.createdAt)}</span>
                        </div>
                    )}
                </div>
                {actions.length > 0 && (
                    <div className="tw-flex tw-flex-wrap tw-gap-2">
                        {actions.map(({ label, variant, nextStatus }) => (
                            <Button key={nextStatus} variant={variant === 'danger' ? 'danger-outline' : 'primary'} onClick={() => orderStatusChange(nextStatus)}>
                                Mark {label.toLowerCase()}
                            </Button>
                        ))}
                    </div>
                )}
            </div>

            {loaded && (
                <div className="tw-space-y-6">
                    <div className="tw-grid tw-grid-cols-1 tw-gap-4 lg:tw-grid-cols-3">
                        <Card className="tw-p-5">
                            <h2 className="tw-flex tw-items-center tw-gap-2 tw-text-sm tw-font-semibold tw-text-slate-900">
                                <UserRound className="tw-h-4 tw-w-4 tw-text-slate-400" aria-hidden /> Buyer
                            </h2>
                            <p className="tw-mt-3 tw-font-medium tw-text-slate-900">{details.OrderedBy?.fullName || '—'}</p>
                            <p className="tw-text-sm tw-tabular-nums tw-text-slate-600">{details.OrderedBy?.phoneNumber}</p>
                            <p className="tw-text-sm tw-text-slate-600">{details.OrderedBy?.email}</p>
                        </Card>
                        <Card className="tw-p-5">
                            <h2 className="tw-flex tw-items-center tw-gap-2 tw-text-sm tw-font-semibold tw-text-slate-900">
                                <MapPin className="tw-h-4 tw-w-4 tw-text-slate-400" aria-hidden /> Deliver to
                                {address?.addressType && <Pill tone="slate" dot={false}>{words(address.addressType)}</Pill>}
                            </h2>
                            <div className="tw-mt-3 tw-space-y-0.5 tw-text-sm tw-text-slate-700">
                                {address?.receiverName && <p className="tw-font-medium tw-text-slate-900">{address.receiverName}</p>}
                                {address?.phone && <p className="tw-tabular-nums">{address.phone}</p>}
                                <p>{[address?.addressLine1, address?.addressLine2].filter(Boolean).join(', ') || '—'}</p>
                                <p>{[address?.PoliceStation?.name, address?.District?.name].filter(Boolean).join(', ')}{address?.postalCode ? ` ${address.postalCode}` : ''}</p>
                            </div>
                        </Card>
                        <Card className="tw-p-5">
                            <h2 className="tw-flex tw-items-center tw-gap-2 tw-text-sm tw-font-semibold tw-text-slate-900">
                                <MessageSquareText className="tw-h-4 tw-w-4 tw-text-slate-400" aria-hidden /> Instructions
                            </h2>
                            <p className="tw-mt-3 tw-whitespace-pre-line tw-text-sm tw-text-slate-700">{details.specialInstructions || <span className="tw-text-slate-400">None given</span>}</p>
                            <div className="tw-mt-4 tw-flex tw-items-baseline tw-justify-between tw-rounded-xl tw-bg-slate-50 tw-px-3 tw-py-2">
                                <span className="tw-text-sm tw-text-slate-600">Order amount</span>
                                <span className="tw-text-lg tw-font-semibold tw-tabular-nums tw-text-slate-900">{bdtExact(Number(details.orderAmount))}</span>
                            </div>
                        </Card>
                    </div>

                    <TableCard
                        toolbar={
                            <p className="tw-flex tw-items-center tw-gap-2 tw-text-sm tw-font-semibold tw-text-slate-900">
                                <ShoppingBag className="tw-h-4 tw-w-4 tw-text-slate-400" aria-hidden /> Items
                            </p>
                        }
                    >
                        <thead>
                            <tr>
                                <th className={cx(TH, 'tw-min-w-[14rem]')}>Product</th>
                                <th className={TH}>Packing</th>
                                <th className={cx(TH, 'tw-text-right')}>Rate</th>
                                <th className={cx(TH, 'tw-text-right')}>Qty</th>
                                <th className={cx(TH, 'tw-text-right')}>Total</th>
                                <th className={TH}>Partner</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item: any, index: number) => (
                                <tr key={index} className={TR}>
                                    <td className={TD}>
                                        <div className="tw-font-medium tw-text-slate-900">{item?.Product?.productName}</div>
                                        <div className="tw-text-xs tw-text-slate-500">{item?.Product?.ProductCategory?.productCategoryName}</div>
                                        {item?.Product?.productDescription && <p className="tw-mt-0.5 tw-line-clamp-2 tw-max-w-md tw-text-xs tw-text-slate-400">{item.Product.productDescription}</p>}
                                    </td>
                                    <td className={cx(TD, 'tw-whitespace-nowrap tw-text-slate-700')}>
                                        {item?.ProductPartner?.ProductPacking?.packingName} {item?.Product?.Unit?.unitCode}
                                    </td>
                                    <td className={cx(TD, 'tw-text-right tw-tabular-nums')}>{bdtExact(Number(item?.rate))}</td>
                                    <td className={cx(TD, 'tw-text-right tw-tabular-nums')}>{item?.quantity}</td>
                                    <td className={cx(TD, 'tw-text-right tw-font-medium tw-tabular-nums tw-text-slate-900')}>{bdtExact(item?.rate * item?.quantity)}</td>
                                    <td className={cx(TD, 'tw-text-sm')}>
                                        <div className="tw-text-slate-800">{item?.ProductPartner?.User?.fullName}</div>
                                        <div className="tw-text-xs tw-tabular-nums tw-text-slate-500">{item?.ProductPartner?.User?.phoneNumber}</div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="tw-border-t tw-border-slate-200">
                                <td colSpan={4} className="tw-px-4 tw-py-3 tw-text-right tw-text-sm tw-font-medium tw-text-slate-600">Grand total</td>
                                <td className="tw-px-4 tw-py-3 tw-text-right tw-text-base tw-font-semibold tw-tabular-nums tw-text-slate-900">{bdtExact(grandTotal)}</td>
                                <td />
                            </tr>
                        </tfoot>
                    </TableCard>
                </div>
            )}
        </div>
    );
}

export default Details;

Details.getLayout = function PageLayout(page: any) {
    return (
        <MainLayout>
            {page}
        </MainLayout>
    )
}
