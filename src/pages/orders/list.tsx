import React, { useState, useEffect } from "react";
import MainLayout from "@/layouts/MainLayout";
import { Container, Table, Button, Pagination } from "react-bootstrap";
import { getRequestOptions } from "@/utils/Fetch";
import Link from "next/link";
import Swal from "sweetalert2";

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

function List() {
    const [orderList, setOrderList] = useState<ListProps[]>([]);
    const [filter, setFilter] = useState<FilterProps>({
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

    });
    const [total, setTotal] = useState<number>(0);
    const [totalPages, setTotalPages] = useState<number>(1);
    useEffect(() => {
        const fetchOrderList = async () => {
            const query = new URLSearchParams(filter as any).toString();
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
            }
        }
        fetchOrderList();
    }, [filter]);

    const handleInputOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFilter({
            ...filter,
            [name]: value
        });
    }

    const pagesNumber = () => {
        if (total === 0) {
            return [];
        }
        let from = Number(filter.page) - 4;
        if (from < 1) {
            from = 1;
        }
        let to = from + 4 * 2
        if (to >= Math.ceil(total / 10)) {
            to = Math.ceil(total / 10)
        }
        let pagesArray = []

        for (let page = from; page <= to; page++) {
            pagesArray.push(page)
        }
        return pagesArray
    }

    const pageList = () => {
        return pagesNumber().map((pageNumber) => {
            return (
                <Pagination.Item key={pageNumber} active={pageNumber === filter.page} onClick={() => handlePageChange(pageNumber)}>
                    {pageNumber}
                </Pagination.Item>
            )
        })
    }

    const handlePageChange = (page: number) => {
        setFilter({
            ...filter,
            page: page
        })
    }

    return (
        <Container>
            <h4 className="text-start">Order List</h4>
            <hr />
            <Table responsive striped bordered hover>
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Order ID</th>
                        <th>Buyer</th>
                        <th>Area</th>
                        <th>Order Amount</th>
                        <th>Order Date</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                    <tr>
                        <td>
                            <input type="number" className="form-control form-control-sm" placeholder="Search" name="idProductOrders" onChange={handleInputOnChange} value={filter.idProductOrders} />
                        </td>
                        <td>
                            <input type="text" className="form-control form-control-sm" placeholder="Search" name="orderId" onChange={handleInputOnChange} value={filter.orderId} />
                        </td>
                        <td>
                            <input type="text" className="form-control form-control-sm" placeholder="Search" name="buyer" onChange={handleInputOnChange} value={filter.buyer} />
                        </td>
                        <td>
                            <input type="text" className="form-control form-control-sm" placeholder="Search" name="area" onChange={handleInputOnChange} value={filter.area} />
                        </td>
                        <td>
                            <input type="text" className="form-control form-control-sm" placeholder="Search" name="orderAmount" onChange={handleInputOnChange} value={filter.orderAmount} />
                        </td>
                        <td>
                            <input type="text" className="form-control form-control-sm" placeholder="Search" name="orderDate" onChange={handleInputOnChange} value={filter.orderDate} />
                        </td>
                        <td>
                            <input type="text" className="form-control form-control-sm" placeholder="Search" name="status" onChange={handleInputOnChange} value={filter.status} />
                        </td>
                        <td></td>
                    </tr>
                </thead>
                <tbody>
                    {orderList.length > 0 ? orderList.map((order, index) => (
                        <tr key={index}>
                            <td>{order.idProductOrders}</td>
                            <td>{order.orderId}</td>
                            <td>{order.buyerName} ({order.buyerPhoneNumber},{order.buyerEmail}) </td>
                            <td>{order.districtName}, {order.policeStationName}</td>
                            <td>{order.orderAmount}</td>
                            <td>{order.orderDate}</td>
                            <td>{order.orderStatus.charAt(0).toUpperCase() + order.orderStatus.slice(1)}</td>
                            <td style={{ whiteSpace: 'nowrap' }}>
                                <Link href={`/orders/details/${order.idProductOrders}`}>
                                    <Button variant="primary" className="me-2">Details</Button>
                                </Link>
                            </td>
                            <td></td>
                        </tr>
                    )) : (
                        <tr>
                            <td colSpan={8} className="text-center">No order found</td>
                        </tr>
                    )}

                </tbody>
            </Table>
            <Pagination>
                <Pagination.First onClick={() => handlePageChange(1)} disabled={filter.page === 1} />
                <Pagination.Prev onClick={() => handlePageChange(filter.page - 1)} disabled={filter.page === 1} />
                {pageList()}
                <Pagination.Next onClick={() => handlePageChange(filter.page + 1)} disabled={filter.page === totalPages} />
                <Pagination.Last onClick={() => handlePageChange(totalPages)} disabled={filter.page === totalPages} />
            </Pagination>
        </Container>
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