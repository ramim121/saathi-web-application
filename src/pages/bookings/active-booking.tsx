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
    };
    ProjectInvestmentBooking: {
        bookingId: string;
        paymentDate: string;
        User: {
            fullName: string;
        };
    };
    idProjectInvestmentBookings: number;
    investmentDate: string;
    unitPurchased: number;
    totalReturnRange: string;
    maturityDate: string;
    remainingTimeFormatted: string;
}

interface FilterProps {
    orderBy: string;
    orderType: string;
    page: number;
    pageSize: number;
}

function formatDate(dateStr?: string): string {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    const day = date.getDate();
    const month = date.toLocaleString("en-GB", { month: "short" });
    const year = date.getFullYear();
    const j = day % 10, k = day % 100;
    let suffix = "th";
    if (j === 1 && k !== 11) suffix = "st";
    else if (j === 2 && k !== 12) suffix = "nd";
    else if (j === 3 && k !== 13) suffix = "rd";
    return `${day}${suffix} ${month} ${year}`;
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
                    setBookingList(data.data);
                    setTotal(data.total);
                } else {
                    Swal.fire({ icon: 'error', title: 'Error', text: data.message });
                }
            } catch (err: any) {
                Swal.fire({ icon: 'error', title: 'Error', text: err.message });
            }
        };
        fetchBookingList();
    }, [filter]);

    const handlePageChange = (page: number) => setFilter({ ...filter, page });

    const renderPagination = () => {
        const totalPages = Math.ceil(total / filter.pageSize);
        if (totalPages <= 1) return null;

        const pages: (number | string)[] = [1];
        if (filter.page > 3) pages.push("...");
        const start = Math.max(2, filter.page - 1);
        const end = Math.min(totalPages - 1, filter.page + 1);
        for (let i = start; i <= end; i++) pages.push(i);
        if (filter.page < totalPages - 2) pages.push("...");
        if (totalPages > 1) pages.push(totalPages);

        return pages.map((p, i) =>
            p === "..." ? (
                <Pagination.Ellipsis key={i} />
            ) : (
                <Pagination.Item key={p} active={p === filter.page} onClick={() => handlePageChange(p as number)}>
                    {p}
                </Pagination.Item>
            )
        );
    };

    return (
        <Container fluid>
            <h4 className="text-start">Active Booking List</h4>
            <hr />
            <Row className="mt-3">
                <Pagination className="d-flex justify-content-center">
                    <Pagination.Prev onClick={() => handlePageChange(Math.max(1, filter.page - 1))} disabled={filter.page === 1} />
                    {renderPagination()}
                    <Pagination.Next onClick={() => handlePageChange(filter.page + 1)} disabled={filter.page === Math.ceil(total / filter.pageSize)} />
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
                        <th>Return</th>
                        <th>Unit Price</th>
                        <th>Investment Amount</th>
                        <th>Returnable Amount</th>
                        <th>Tenure</th>
                        <th>Start Date</th>
                        <th>Maturity Date</th>
                        <th>Remaining</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {bookingList.length > 0 ? bookingList.map((b, i) => {
                        const { Project: p, ProjectInvestmentBooking: pib } = b;
                        const investmentAmount = b.unitPurchased * p.unitInvestmentValue;
                        return (
                            <tr key={i}>
                                <td>{b.idProjectInvestmentBookings}</td>
                                <td>{pib?.bookingId}</td>
                                <td>{pib?.User?.fullName}</td>
                                <td>{p?.projectName}</td>
                                <td>{b.unitPurchased}</td>
                                <td>{`${p.returnRangeMin}% - ${p.returnRangeMax}%`}</td>
                                <td>{p.unitInvestmentValue}</td>
                                <td>{investmentAmount}</td>
                                <td>{b.totalReturnRange}</td>
                                <td>{p?.tenure ? `${p.duration} ${p.tenure}` : "-"}</td>
                                <td>{formatDate(pib?.paymentDate)}</td>
                                <td>{b.maturityDate !== '-' ? formatDate(b.maturityDate) : ''}</td>
                                <td>{b.remainingTimeFormatted}</td>
                                <td>
                                    <Link href={`/bookings/details/${b.idProjectInvestmentBookings}`}>
                                        <Button size="sm" variant="primary">Details</Button>
                                    </Link>
                                </td>
                            </tr>
                        );
                    }) : (
                        <tr>
                            <td colSpan={14} className="text-center">No Active Booking Found</td>
                        </tr>
                    )}
                </tbody>
            </Table>
        </Container>
    );
}

export default ActiveBooking;

ActiveBooking.getLayout = function PageLayout(page: any) {
    return <MainLayout>{page}</MainLayout>;
};
