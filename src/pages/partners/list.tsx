import React, { useState, useEffect } from "react";
import MainLayout from "@/layouts/MainLayout";
import { Container, Table, Button } from "react-bootstrap";
import { getRequestOptions } from "@/utils/Fetch";
import Link from "next/link";

interface ListProps {
    idUsers: number,
    fullName: string,
    phoneNumber: string,
    age: number,
    location: string,
    role: string,
    joiningDate: string,
    skills: string
}

function List() {
    const [partnersList, setPartnersList] = useState<ListProps[]>([]);

    useEffect(() => {
        const fetchPartnersList = async () => {
            try {
                const res = await fetch('/api/partners/list', getRequestOptions());
                const data = await res.json();
                if (res.status === 200) {
                    setPartnersList(data);
                } else {
                    console.log('Failed to fetch partners list');
                }
            } catch (err) {
                console.log(err);
            }
        }
        fetchPartnersList();
    }, []);

    return (
        <Container>
            <h2 className="text-center">Partners List</h2>
            <hr />
            <Table responsive striped bordered hover>
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Full Name</th>
                        <th>Phone Number</th>
                        <th>Age</th>
                        <th>Location</th>
                        <th>Role</th>
                        <th>Joining Date</th>
                        <th>Skills</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {partnersList.length > 0 ? partnersList.map((partner, index) => (
                        <tr key={partner.idUsers}>
                            <td>{index + 1}</td>
                            <td>{partner.fullName}</td>
                            <td>{partner.phoneNumber}</td>
                            <td>{partner.age}</td>
                            <td>{partner.location}</td>
                            <td>{partner.role}</td>
                            <td>{partner.joiningDate}</td>
                            <td>{partner.skills}</td>
                            <td>
                                <Link href={`/partners/details/${partner.idUsers}`}>
                                    <Button variant="primary">Details</Button>
                                </Link>
                            </td>
                        </tr>
                    )) : (
                        <tr>
                            <td colSpan={9} className="text-center">No partners found</td>
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