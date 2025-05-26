import React, { useState, useEffect } from "react";
import MainLayout from "@/layouts/MainLayout";
import Swal from "sweetalert2";
import { Container, Table, Button, Pagination, Row } from "react-bootstrap";
import Link from "next/link";
import { getRequestOptions } from "@/utils/Fetch";

interface BookingListProps {
    Project: {
        projectName: string;
        duration: number;
        tenure: string;
        returnRangeMin: number;
        returnRangeMax: number;
        unitInvestmentValue: number;
    }
    ProjectInvestmentBooking: {
        bookingId: string;
        paymentDate: string;
        User: {
            fullName: string;
        }
    }
    idProjectInvestmentBookings: number;
    investmentDate: string;
    unitPurchased: number;
}

interface FilterProps {
    orderBy: string;
    orderType: string;
    page: number;
    pageSize: number;
}

// Helper to calculate remaining days until maturity
function getRemainingDays(booking: BookingListProps) {
    const paymentDate = booking?.ProjectInvestmentBooking?.paymentDate;
    const duration = booking?.Project?.duration;
    const tenure = booking?.Project?.tenure?.toLowerCase();

    if (!paymentDate || !duration || !tenure) return Number.MAX_SAFE_INTEGER;
    const startDate = new Date(paymentDate);

    if (tenure === "months" || tenure === "month") {
        startDate.setMonth(startDate.getMonth() + duration);
    } else if (tenure === "years" || tenure === "year") {
        startDate.setFullYear(startDate.getFullYear() + duration);
    } else if (tenure === "days" || tenure === "day") {
        startDate.setDate(startDate.getDate() + duration);
    } else {
        return Number.MAX_SAFE_INTEGER;
    }

    const now = new Date();
    const remainingTime = Math.max(0, startDate.getTime() - now.getTime());
    const daysRemaining = Math.ceil(remainingTime / (1000 * 60 * 60 * 24));
    return daysRemaining > 0 ? daysRemaining : 0;
}

function ActiveBooking() {

    const [bookingList, setBookingList] = useState<BookingListProps[]>([]);
    const [filter, setFilter] = useState<FilterProps>({
        orderBy: 'idProjectInvestmentBookings',
        orderType: 'DESC',
        page: 1,
        pageSize: 10
    });

    const [total, setTotal] = useState<number>(0);

    useEffect(() => {
        const fetchBookingList = async () => {
            const query = new URLSearchParams(filter as any).toString();
            try {
                const res = await fetch(`/api/bookings/active-booking?${query}`, getRequestOptions());
                const data = await res.json();
                if (res.status === 200) {
                    // Sort by remaining days ascending (earliest first)
                    const sortedData = [...data.data].sort(
                        (a, b) => getRemainingDays(a) - getRemainingDays(b)
                    );
                    setBookingList(sortedData);
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

    const pagesNumber = () => {
        if (total === 0) return [];

        const totalPageCount = Math.ceil(total / filter.pageSize);
        const currentPage = filter.page;

        let pagesArray = [];
        pagesArray.push(1);

        if (currentPage > 3) {
            pagesArray.push("...");
        }

        let startPage = Math.max(2, currentPage - 1);
        let endPage = Math.min(totalPageCount - 1, currentPage + 1);

        for (let page = startPage; page <= endPage; page++) {
            pagesArray.push(page);
        }

        if (currentPage < totalPageCount - 2) {
            pagesArray.push("...");
        }

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
            <h4 className="text-start">Active Booking List</h4>
            <hr />
            <Row className="mt-3">
                <Pagination className="d-flex justify-content-center">
                    <Pagination.Prev
                        onClick={() => handlePageChange(Math.max(1, filter.page - 1))}
                        disabled={filter.page === 1}
                    />
                    {pageList()}
                    <Pagination.Next
                        onClick={() => handlePageChange(filter.page + 1)}
                        disabled={filter.page === Math.ceil(total / filter.pageSize)}
                    />
                </Pagination>
            </Row>
            <Table responsive striped bordered hover size="sm">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Booking Id</th>
                        <th>Investor Name</th>
                        <th>Project Name</th>
                        <th>Unit Purchased</th>
                        <th>Unit Price</th>
                        <th>Return</th>
                        <th>Returnable Amount</th>
                        <th>Tenure</th>
                        <th>Start Date</th>
                        <th>Maturity Date</th>
                        <th>Remaining</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {bookingList.length > 0 ? bookingList.map((booking, index) => (
                        <tr key={index}>
                            <td>{booking.idProjectInvestmentBookings}</td>
                            <td>{booking?.ProjectInvestmentBooking?.bookingId}</td>
                            <td>{booking?.ProjectInvestmentBooking?.User?.fullName}</td>
                            <td>{booking?.Project?.projectName}</td>
                            <td>{booking?.unitPurchased}</td>
                            <td>{booking?.Project?.unitInvestmentValue}</td>
                            <td>{`${booking.Project.returnRangeMin}% - ${booking.Project.returnRangeMax}%`}</td>
                            <td>
                                {booking?.unitPurchased && booking?.Project?.unitInvestmentValue && booking?.Project?.returnRangeMin !== undefined && booking?.Project?.returnRangeMax !== undefined
                                    ? (
                                        (() => {
                                            const principal = booking.unitPurchased * booking.Project.unitInvestmentValue;
                                            const minReturn = principal + (principal * (booking.Project.returnRangeMin / 100));
                                            const maxReturn = principal + (principal * (booking.Project.returnRangeMax / 100));
                                            return `${minReturn.toFixed(2)} - ${maxReturn.toFixed(2)}`;
                                        })()
                                    )
                                    : "-"}
                            </td>
                            <td>
                                {booking?.Project?.tenure ? `${booking?.Project?.duration} ${booking?.Project?.tenure}` : "-"}
                            </td>
                            <td>{booking?.ProjectInvestmentBooking?.paymentDate}</td>
                            <td>
                                {(() => {
                                    const paymentDate = booking?.ProjectInvestmentBooking?.paymentDate;
                                    const duration = booking?.Project?.duration;
                                    const tenure = booking?.Project?.tenure?.toLowerCase();

                                    if (!paymentDate || !duration || !tenure) return "-";
                                    const date = new Date(paymentDate);

                                    if (tenure === "months" || tenure === "month") {
                                        date.setMonth(date.getMonth() + duration);
                                    } else if (tenure === "years" || tenure === "year") {
                                        date.setFullYear(date.getFullYear() + duration);
                                    } else if (tenure === "days" || tenure === "day") {
                                        date.setDate(date.getDate() + duration);
                                    } else {
                                        return "-";
                                    }

                                    return date.toISOString().split("T")[0];
                                })()}
                            </td>
                            <td>
                                {(() => {
                                    const daysRemaining = getRemainingDays(booking);
                                    return daysRemaining > 0 ? `${daysRemaining} days` : "Completed";
                                })()}
                            </td>
                            <td>
                                <Link href={`/bookings/details/${booking.idProjectInvestmentBookings}`}>
                                    <Button size="sm" variant="primary">Details</Button>
                                </Link>
                            </td>
                        </tr>
                    )) : (
                        <tr>
                            <td colSpan={13} className="text-center">No Active Booking Found</td>
                        </tr>
                    )}

                </tbody>
            </Table>
        </Container>
    )
}

export default ActiveBooking;

ActiveBooking.getLayout = function PageLayout(page: any) {
    return (
        <MainLayout>
            {page}
        </MainLayout>
    )
}
