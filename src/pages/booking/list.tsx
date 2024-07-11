import React, { useState, useEffect } from "react";
import MainLayout from "@/layouts/MainLayout";
import Swal from "sweetalert2";
import { Container, Table, Button, Pagination } from "react-bootstrap";
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
    }[];
    // unitPurchased: number;
    // investmentDate: string;
    // investmentStatus: string;
    // totalInvestedAmount: number;
    // Project: {
    //     projectName: string;
    //     location: string;
    // };
    // User: {
    //     fullName: string;
    // };
    // ProjectPartnerInvestors: {
    //     ProjectPartner: {
    //         User: {
    //             fullName: string;
    //         };
    //     };
    // }[];
}

interface FilterProps {
    idProjectInvestmentBookings: string;
    bookingId: string;
    investorName: string;
    paymentConfirmationStatus: string;
    // projects: string;
    // unitPurchased: string;
    // investmentDate: string;
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
        // projects: '',
        // unitPurchased: '',
        // investmentDate: '',
        orderBy: 'idProjectInvestmentBookings',
        orderType: 'DESC',
        page: 1,
        pageSize: 10
    });

    const [total, setTotal] = useState<number>(0);
    const [totalPages, setTotalPages] = useState<number>(1);

    useEffect(() => {
        const fetchBookingList = async () => {
            const query = new URLSearchParams(filter as any).toString();
            try {
                const res = await fetch(`/api/booking/list?${query}`, getRequestOptions());
                const data = await res.json();
                if (res.status === 200) {
                    setBookingList(data.data);
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
        fetchBookingList();
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
            <h2 className="text-center">Booking List</h2>
            <hr />
            <Table responsive striped bordered hover>
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Booking Id</th>
                        <th>Investor Name</th>
                        <th>Payment Status</th>
                        <th>Projects</th>
                        <th>Unit Purchased</th>
                        <th>Investment Date</th>
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
                            <input type="text" className="form-control form-control-sm" placeholder="Search" name="paymentConfirmationStatus" onChange={handleInputOnChange} value={filter.paymentConfirmationStatus} />
                        </td>
                        {/* <td>
                            <input type="text" className="form-control form-control-sm" placeholder="Search" name="projects" onChange={handleInputOnChange} value={filter.projects} />
                        </td>
                        <td>
                            <input type="number" className="form-control form-control-sm" placeholder="Search" name="unitPurchased" onChange={handleInputOnChange} value={filter.unitPurchased} />
                        </td>
                        <td>
                            <input type="date" className="form-control form-control-sm" placeholder="Search" name="investmentDate" onChange={handleInputOnChange} value={filter.investmentDate} />
                        </td> */}
                        <td></td>
                        <td></td>
                        <td></td>
                        <td></td>

                    </tr>
                </thead>
                <tbody>
                    {bookingList.length > 0 ? bookingList.map((booking, index) => (
                        <tr key={index}>
                            <td>{booking.idProjectInvestmentBookings}</td>
                            <td>{booking.bookingId}</td>
                            <td>{booking.User.fullName}</td>
                            <td>{booking.paymentConfirmationStatus}</td>
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
                            </td>

                            {/* <td>{booking?.User.fullName}</td>
                            <td>{booking.Project.projectName}</td>
                            <td>{booking.unitPurchased}</td>
                            <td>
                                <ul>
                                    {booking.ProjectPartnerInvestors && booking.ProjectPartnerInvestors.map((partner, index) => (
                                        <li key={index}>{partner.ProjectPartner?.User?.fullName}</li>
                                    ))}
                                </ul>
                            </td>
                            <td>{booking.totalInvestedAmount}</td>
                            <td>{booking.investmentDate}</td>
                            <td>{booking.investmentStatus}</td>
                            <td>
                                <Link href={`/booking/details/${booking.idProjectInvestors}`}>
                                    <Button variant="primary">Details</Button>
                                </Link>
                            </td> */}
                        </tr>
                    )) : (
                        <tr>
                            <td colSpan={8} className="text-center">No booking found</td>
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
