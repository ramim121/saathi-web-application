import React, { useState, useEffect } from "react";
import MainLayout from "@/layouts/MainLayout";
import { Container, Table, Button, Pagination } from "react-bootstrap";
import { getRequestOptions } from "@/utils/Fetch";
import Link from "next/link";
import Swal from "sweetalert2";

interface ListProps {
    idManualNotifications: string,
    sendViaSms: string,
    sendViaEmail: string,
    sendViaPush: string,
    formattedSendOn: string,
    User: {
        fullName: string
    },
}

interface FilterProps {
    idManualNotifications: string,
    sendViaSms: string,
    sendViaEmail: string,
    sendViaPush: string,
    sendOn: string,
    createdBy: string,
    orderBy: string,
    orderType: string,
    page: number,
    pageSize: number
}

function List() {
    const [manualNotificationList, setManualNotificationList] = useState<ListProps[]>([]);
    const [filter, setFilter] = useState<FilterProps>({
        idManualNotifications: '',
        sendViaSms: '',
        sendViaEmail: '',
        sendViaPush: '',
        sendOn: '',
        createdBy: '',
        orderBy: 'idManualNotifications',
        orderType: 'DESC',
        page: 1,
        pageSize: 10

    });
    const [total, setTotal] = useState<number>(0);
    const [totalPages, setTotalPages] = useState<number>(1);
    useEffect(() => {
        const fetchManualNotificationList = async () => {
            const query = new URLSearchParams(filter as any).toString();
            try {
                const res = await fetch(`/api/manual-notification/list?${query}`, getRequestOptions());
                const data = await res.json();
                if (res.status === 200) {
                    setManualNotificationList(data.data);
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
        fetchManualNotificationList();
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
            <h4 className="text-start">Partners List</h4>
            <hr />
            <Table responsive striped bordered hover>
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Send Via Sms</th>
                        <th>Send Via Email</th>
                        <th>Send Via Push</th>
                        <th>Send On</th>
                        <th>Created By</th>
                        <th>Actions</th>
                    </tr>
                    <tr>
                        <td>
                            <input type="number" className="form-control form-control-sm" placeholder="Search" name="idManualNotifications" onChange={handleInputOnChange} value={filter.idManualNotifications} />
                        </td>
                        <td>
                            <input type="text" className="form-control form-control-sm" placeholder="Search" name="sendViaSms" onChange={handleInputOnChange} value={filter.sendViaSms} />
                        </td>
                        <td>
                            <input type="text" className="form-control form-control-sm" placeholder="Search" name="sendViaEmail" onChange={handleInputOnChange} value={filter.sendViaEmail} />
                        </td>
                        <td>
                            <input type="text" className="form-control form-control-sm" placeholder="Search" name="sendViaPush" onChange={handleInputOnChange} value={filter.sendViaPush} />
                        </td>
                        <td>
                            <input type="text" className="form-control form-control-sm" placeholder="Search" name="sendOn" onChange={handleInputOnChange} value={filter.sendOn} />
                        </td>
                        <td>
                            <input type="text" className="form-control form-control-sm" placeholder="Search" name="createdBy" onChange={handleInputOnChange} value={filter.createdBy} />
                        </td>
                        <td></td>

                    </tr>
                </thead>
                <tbody>
                    {manualNotificationList.length > 0 ? manualNotificationList.map((notification, index) => (
                        <tr key={index}>
                            <td>{notification.idManualNotifications}</td>
                            <td>{notification.sendViaSms.charAt(0).toUpperCase() + notification.sendViaSms.slice(1)}</td>
                            <td>{notification.sendViaEmail.charAt(0).toUpperCase() + notification.sendViaEmail.slice(1)}</td>
                            <td>{notification.sendViaPush.charAt(0).toUpperCase() + notification.sendViaPush.slice(1)}</td>
                            <td>{notification.formattedSendOn}</td>
                            <td>{notification?.User?.fullName}</td>
                            <td style={{ whiteSpace: 'nowrap' }}>
                                <Link href={`/manualNotification/details/${notification.idManualNotifications}`}>
                                    <Button variant="primary" className="me-2">Details</Button>
                                </Link>
                            </td>
                        </tr>
                    )) : (
                        <tr>
                            <td colSpan={7} className="text-center">No Manual Notification found</td>
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