import React, { useState, useEffect } from "react";
import MainLayout from "@/layouts/MainLayout";
import Swal from "sweetalert2";
import { Container, Table, Button, Pagination, Row, Form, Nav } from "react-bootstrap";
import Link from "next/link";
import { getRequestOptions } from "@/utils/Fetch";

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
    const [activeTab, setActiveTab] = useState<string>("current");

    useEffect(() => {
        const fetchBookingList = async () => {
            const query = new URLSearchParams(filter as any).toString();
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

    const handleTabChange = (tab: string) => {
        setActiveTab(tab);
        setFilter({
            ...filter,
            cancelled: tab === "cancelled" ? "yes" : "no",
            page: 1,
        });
    };

    const pagesNumber = () => {
        if (total === 0) return [];

        const totalPageCount = Math.ceil(total / filter.pageSize);
        const currentPage = filter.page;

        let pagesArray = [];

        // Always show the first page
        pagesArray.push(1);

        // If current page is greater than 3, add an ellipsis before the first middle range
        if (currentPage > 3) {
            pagesArray.push("...");
        }

        // Add a range of pages around the current page
        let startPage = Math.max(2, currentPage - 1);
        let endPage = Math.min(totalPageCount - 1, currentPage + 1);

        for (let page = startPage; page <= endPage; page++) {
            pagesArray.push(page);
        }

        // Add an ellipsis after the last middle range if there are more pages
        if (currentPage < totalPageCount - 2) {
            pagesArray.push("...");
        }

        // Always show the last page
        if (totalPageCount > 1) {
            pagesArray.push(totalPageCount);
        }

        return pagesArray;
    };

    const pageList = () => {
        return pagesNumber().map((pageNumber, index) => {
            if (pageNumber === "...") {
                return <Pagination.Ellipsis key={`ellipsis-${index}`} />;
            } else {
                return (
                    <Pagination.Item
                        key={pageNumber}
                        active={pageNumber === filter.page}
                        onClick={() => handlePageChange(pageNumber as number)}
                    >
                        {pageNumber}
                    </Pagination.Item>
                );
            }
        });
    };


    const handlePageChange = (page: number) => {
        setFilter({
            ...filter,
            page: page
        })
    }

    return (
        <Container>
            <h4 className="text-start">Booking List</h4>
            <hr />
            <Nav variant="tabs" activeKey={activeTab} onSelect={(selectedKey) => handleTabChange(selectedKey || "current")}>
                <Nav.Item>
                    <Nav.Link eventKey="current">Current Bookings</Nav.Link>
                </Nav.Item>
                <Nav.Item>
                    <Nav.Link eventKey="cancelled">Cancelled Bookings</Nav.Link>
                </Nav.Item>
            </Nav>
            <Row className="mt-3">
                <Pagination className="d-flex justify-content-center">
                    <Pagination.Prev onClick={() => handlePageChange(filter.page - 1)} />
                    {pageList()}
                    <Pagination.Next onClick={() => handlePageChange(filter.page + 1)} />
                </Pagination>
            </Row>
            <Table responsive striped bordered hover size="sm">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Booking Id</th>
                        <th>Investor Name</th>
                        <th>Payment Status</th>
                        <th>Projects</th>
                        <th>Project Status</th>
                        <th>Unit Purchased</th>
                        <th>Investment Date</th>
                        <th>Maturity Date</th>
                        <th>Cancelled</th>
                        <th>Actions</th>

                    </tr>
                    <tr>
                        <td>
                            <input type="number" className="form-control form-control-sm" placeholder="Search" name="idProjectInvestmentBookings" onChange={handleInputOnChange} value={filter.idProjectInvestmentBookings} />
                        </td>
                        <td>
                            <input type="text" className="form-control form-control-sm" placeholder="Search" name="bookingId" onChange={handleInputOnChange} value={filter.bookingId} />
                        </td>
                        <td>
                            <input type="text" className="form-control form-control-sm" placeholder="Search" name="investorName" onChange={handleInputOnChange} value={filter.investorName} />
                        </td>
                        <td>
                            <Form.Select className="form-control form-control-sm" name="paymentConfirmationStatus" onChange={handleInputOnChange} value={filter.paymentConfirmationStatus}>
                                <option value="">All</option>
                                <option value="pending">Pending</option>
                                <option value="uploaded">Proof submitted (uploaded)</option>
                                <option value="proof_submitted">Proof submitted</option>
                                <option value="confirmed">Confirmed</option>
                                <option value="denied">Denied</option>
                            </Form.Select>
                        </td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>
                        <td>
                            <Form.Select className="form-control form-control-sm" name="cancelled" onChange={handleInputOnChange} value={filter.cancelled}>
                                <option value="">All</option>
                                <option value="yes">Yes</option>
                                <option value="no">No</option>
                            </Form.Select>
                        </td>
                        <td></td>
                    </tr>
                </thead>
                <tbody>
                    {bookingList.length > 0 ? bookingList.map((booking, index) => (
                        <tr key={index}>
                            <td>{booking.idProjectInvestmentBookings}</td>
                            <td>{booking.bookingId}</td>
                            <td>{booking.User.fullName}</td>
                            <td>{booking.paymentConfirmationStatus?.charAt(0).toUpperCase() + booking.paymentConfirmationStatus?.slice(1)}
                            </td>
                            <td>
                                <ul>
                                    {booking.ProjectInvestors.map((invest, index) => (
                                        <li key={index}>{invest.Project.projectName}</li>
                                    ))
                                    }
                                </ul>
                            </td>
                            <td>
                                <ul>
                                    {booking.ProjectInvestors.map((invest, index) => (
                                        <li key={index}>{invest.investmentStatus?.replace(/_/g, ' ').charAt(0).toUpperCase() + invest.investmentStatus?.replace(/_/g, ' ').slice(1)}</li>
                                    ))
                                    }
                                </ul>
                            </td>
                            <td>
                                <ul>
                                    {booking.ProjectInvestors.map((invest, index) => (
                                        <li key={index}>{invest.unitPurchased}</li>
                                    ))
                                    }
                                </ul>
                            </td>
                            <td>
                                <ul>
                                    {booking.ProjectInvestors.map((invest, index) => (
                                        <li key={index}>{invest.investmentDate}</li>
                                    ))
                                    }
                                </ul>
                            </td>
                            <td>
                                <ul>
                                    {booking.ProjectInvestors.map((invest, index) => (
                                        <li key={index}>{invest.maturityDate}</li>
                                    ))
                                    }
                                </ul>
                            </td>
                            <td>{booking.cancelled?.charAt(0).toUpperCase() + booking.cancelled?.slice(1)}</td>
                            <td>
                                <Link href={`/bookings/details/${booking.idProjectInvestmentBookings}`}>
                                    <Button size="sm" variant="primary">Details</Button>
                                </Link>
                            </td>
                        </tr>
                    )) : (
                        <tr>
                            <td colSpan={11} className="text-center">No booking found</td>
                        </tr>
                    )}

                </tbody>
            </Table>
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
