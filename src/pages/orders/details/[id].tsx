/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef } from "react";
import MainLayout from "@/layouts/MainLayout";
import { useRouter } from "next/router";
import { getRequestOptions, postRequestOptions } from "@/utils/Fetch";
import { Container, Row, Table, Col, Tab, Tabs, Form, Button, Spinner } from "react-bootstrap";
import { API_URL } from '@/config/public';
import Swal from "sweetalert2";

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
        setReload(true);
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


    return (
        <Container>
            <h4 className="text-start"> Order Details ({details?.orderId})</h4>
            <hr />
            <Tabs defaultActiveKey="details" id="uncontrolled-tab-example" className="mb-3">
                <Tab eventKey="details" title="Details">
                    <Row>
                        <Col md={6}>
                            <Table bordered>
                                <tbody>
                                    <tr>
                                        <td>Order Id</td>
                                        <td>{details?.orderId}</td>
                                    </tr>
                                    <tr>
                                        <td>Buyer Name</td>
                                        <td>{details?.OrderedBy?.fullName}</td>
                                    </tr>
                                    <tr>
                                        <td>Buyer Email</td>
                                        <td>{details?.OrderedBy?.email}</td>
                                    </tr>
                                    <tr>
                                        <td>Buyer Phone Number</td>
                                        <td>{details?.OrderedBy?.phoneNumber}</td>
                                    </tr>
                                    <tr>
                                        <td>Order Amount</td>
                                        <td>{details?.orderAmount}</td>
                                    </tr>
                                    <tr>
                                        <td>Order Date</td>
                                        <td>{new Date(details?.createdAt).toLocaleDateString()}</td>
                                    </tr>
                                    <tr>
                                        <td>Order Status</td>
                                        <td>{details?.orderStatus?.charAt(0).toUpperCase() + details?.orderStatus?.slice(1)}</td>
                                    </tr>
                                    <tr>
                                        <td>Special Instructions</td>
                                        <td>{details?.specialInstructions}</td>
                                    </tr>
                                    <tr>
                                        <td>Address</td>
                                        <td>
                                            {details?.UserAddress?.addressLine1 && details?.UserAddress?.addressLine1}
                                            {details?.UserAddress?.addressLine2 && `, ${details?.UserAddress?.addressLine2}`} <br />
                                            {details?.UserAddress?.District?.name && details?.UserAddress?.District?.name}
                                            {details?.UserAddress?.PoliceStation?.name && `, ${details?.UserAddress?.PoliceStation?.name}`} <br />
                                            {details?.UserAddress?.receiverName && details?.UserAddress?.receiverName} <br />
                                            {details?.UserAddress?.phone && details?.UserAddress?.phone} <br />
                                            {details?.UserAddress?.addressType && (details?.UserAddress?.addressType.charAt(0).toUpperCase() + details?.UserAddress?.addressType.slice(1))} <br />
                                        </td>
                                    </tr>
                                </tbody>
                            </Table>
                        </Col>
                    </Row>
                    <Row>
                        <Col md={12}>
                            <h5>Ordered Items</h5>
                            <Table bordered striped hover responsive>
                                <thead>
                                    <tr>
                                        <th>Sl</th>
                                        <th>Product Name</th>
                                        <th>Description</th>
                                        <th>Category</th>
                                        <th>Packing</th>
                                        <th>Rate</th>
                                        <th>Quantity</th>
                                        <th>Total Price</th>
                                        <th>Partner</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {details?.ProductOrderItems?.map((item: any, index: number) => (
                                        <tr key={index}>
                                            <td>{index + 1}</td>
                                            <td>{item?.Product?.productName}</td>
                                            <td>{item?.Product?.productDescription}</td>
                                            <td>{item?.Product?.ProductCategory?.productCategoryName}</td>
                                            <td>{item?.ProductPartner?.ProductPacking?.packingName} {item?.Product?.Unit?.unitCode}</td>
                                            <td>{item?.rate}</td>
                                            <td>{item?.quantity}</td>
                                            <td>{item?.rate * item?.quantity}</td>
                                            <td>{item?.ProductPartner?.User?.fullName} ({item?.ProductPartner?.User?.phoneNumber})</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <td colSpan={7} className="text-end">Grand Total</td>
                                        <td>{details?.ProductOrderItems?.reduce((acc: number, item: any) => acc + (item?.rate * item?.quantity), 0)}</td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            </Table>
                        </Col>
                    </Row>
                    <Row className='justify-content-center mt-3'>
                        {actions.map(({ label, variant, nextStatus }) => (
                            <Button key={nextStatus} className='w-25' variant={variant} onClick={() => orderStatusChange(nextStatus)}>
                                {label}
                            </Button>
                        ))}
                    </Row>
                </Tab>
            </Tabs>
        </Container>
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