import React, { useState, useEffect } from "react";
import MainLayout from "@/layouts/MainLayout";
import Swal from "sweetalert2";
import { Container, Table, Button } from "react-bootstrap";
import Link from "next/link";

interface BookingListProps {
    idProjectInvestors: number;
    unitPurchased: number;
    investmentDate: string;
    investmentStatus: string;
    totalInvestedAmount: number;
    Project: {
        projectName: string;
        location: string;
    };
    User: {
        fullName: string;
    };
    ProjectPartnerInvestors: {
        ProjectPartner: {
            User: {
                fullName: string;
            };
        };
    }[];
}

function List() {

    const [bookingList, setBookingList] = useState<BookingListProps[]>([]);

    useEffect(() => {
        const fetchBookingList = async () => {
            try {
                const res = await fetch('/api/booking/list');
                const data = await res.json();
                if (res.status === 200) {
                    setBookingList(data.data);
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
    }, []);

    return (
        <Container>
            <h2 className="text-center">Booking List</h2>
            <hr />
            <Table responsive striped bordered hover>
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Investor</th>
                        <th>Project</th>
                        <th>Unit Purchased</th>
                        <th>Partners</th>
                        <th>Investment Amount</th>
                        <th>Investment Date</th>
                        <th>Status</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {bookingList.length > 0 ? bookingList.map((booking, index) => (
                        <tr key={index}>
                            <td>{index + 1}</td>
                            <td>{booking?.User.fullName}</td>
                            <td>{booking.Project.projectName}</td>
                            <td>{booking.unitPurchased}</td>
                            <td>
                                <ul>
                                    {booking.ProjectPartnerInvestors && booking.ProjectPartnerInvestors.map((partner, index) => (
                                        <li key={index}>{partner.ProjectPartner.User.fullName}</li>
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
                            </td>
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
