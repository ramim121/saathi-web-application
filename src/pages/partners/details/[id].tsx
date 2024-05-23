import React, { useState, useEffect } from "react";
import MainLayout from "@/layouts/MainLayout";
import { useRouter } from "next/router";
import { getRequestOptions } from "@/utils/Fetch";
import { Container, Row, Table, Col } from "react-bootstrap";

interface DetailsProps {
    idUsers: number,
    fullName: string,
    phoneNumber: string,
    age: number,
    location: string,
    role: string,
    joiningDate: string,
    skills: string,
    interestedIn: string,
    painPoints: string,
    motivation: string,
}

function Details() {
    const router = useRouter();
    const { id } = router.query;
    const [details, setDetails] = useState<DetailsProps>({} as DetailsProps);

    useEffect(() => {
        if (id != undefined) {
            const fetchPartnerDetails = async () => {
                try {
                    const res = await fetch('/api/partners/details/' + id, getRequestOptions());
                    const data = await res.json();
                    if (res.status === 200) {
                        setDetails(data);
                    } else {
                        console.log('Failed to fetch partners details');
                    }
                } catch (err) {
                    console.log(err);
                }
            }
            fetchPartnerDetails();
        }
    }, [id])

    return (
        <Container>
            <h2 className="text-center"> Partner Details</h2>
            <hr />
            <Row>
                <Col md={6}>
                    <Table bordered>
                        <tbody>
                            <tr>
                                <td>Full Name</td>
                                <td>{details.fullName}</td>
                            </tr>
                            <tr>
                                <td>Phone Number</td>
                                <td>{details.phoneNumber}</td>
                            </tr>
                            <tr>
                                <td>Age</td>
                                <td>{details.age}</td>
                            </tr>
                            <tr>
                                <td>Location</td>
                                <td>{details.location}</td>
                            </tr>
                            <tr>
                                <td>Motivation</td>
                                <td dangerouslySetInnerHTML={{ __html: details.motivation }}></td>
                            </tr>
                        </tbody>
                    </Table>
                </Col>
                <Col md={6}>
                    <Table bordered>
                        <tbody>
                            <tr>
                                <td>Role</td>
                                <td>{details.role}</td>
                            </tr>
                            <tr>
                                <td>Joining Date</td>
                                <td>{details.joiningDate}</td>
                            </tr>
                            <tr>
                                <td>Skills</td>
                                <td>{details.skills}</td>
                            </tr>
                            <tr>
                                <td>Interested In</td>
                                <td>{details.interestedIn}</td>
                            </tr>
                            <tr>
                                <td>Pain Points</td>
                                <td dangerouslySetInnerHTML={{ __html: details.painPoints }}></td>
                            </tr>
                        </tbody>
                    </Table>
                </Col>
            </Row>
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
