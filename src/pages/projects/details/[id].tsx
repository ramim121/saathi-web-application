import React, { useState, useEffect } from "react";
import MainLayout from "@/layouts/MainLayout";
import { useRouter } from "next/router";
import { getRequestOptions } from "@/utils/Fetch";
import { Container, Row, Table, Col } from "react-bootstrap";

interface DetailsProps {
    idProjects: number,
    projectName: string,
    location: string,
    unitInvestmentValue: number,
    otherLocations: string,
    investmentType: string,
    returnType: string,
    duration: number,
    tenure: string,
    projectStatus: string,
    totalReturnMin: number,
    totalReturnMax: number,
    returnRangeMin: number,
    returnRangeMax: number,
    collectionStarts: string,
    collectionEnds: string,
    summary: string,
    ProjectPartners: {
        User: {
            fullName: string
        }
    },
    CreatedBy: {
        fullName: string
    },
}

function Details() {
    const router = useRouter();
    const { id } = router.query;
    const [details, setDetails] = useState<DetailsProps>({} as DetailsProps);

    useEffect(() => {
        if (id != undefined) {
            const fetchProjectDetails = async () => {
                try {
                    const res = await fetch('/api/projects/details/' + id, getRequestOptions());
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
            fetchProjectDetails();
        }
    }, [id])

    return (
        <Container>
            <h2 className="text-center"> Project Details</h2>
            <hr />
            <Row>
                <Col md={6}>
                    <Table bordered>
                        <tbody>
                            <tr>
                                <td>Project Name</td>
                                <td>{details.projectName}</td>
                            </tr>
                            <tr>
                                <td>Location</td>
                                <td>{details.location}</td>
                            </tr>
                            <tr>
                                <td>Share / Unit</td>
                                <td>{details.unitInvestmentValue}</td>
                            </tr>
                            <tr>
                                <td> Investment Type</td>
                                <td>{details.investmentType?.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}</td>
                            </tr>
                            <tr>
                                <td>Return Type</td>
                                <td>{details.returnType}</td>
                            </tr>
                            <tr>
                                <td>Return</td>
                                <td>{details.returnRangeMin}% - {details.returnRangeMax}%</td>
                            </tr>
                            <tr>
                                <td>Amount</td>
                                <td>{details.totalReturnMin} - {details.totalReturnMax}</td>
                            </tr>
                            <tr>
                                <td>Tenure</td>
                                <td>{details.duration} {details.tenure}</td>
                            </tr>
                        </tbody>
                    </Table>
                </Col>
                <Col md={6}>
                    <Table bordered>
                        <tbody>
                            <tr>
                                <td>Collection Starts</td>
                                <td>{details.collectionStarts}</td>
                            </tr>
                            <tr>
                                <td>Collection Ends</td>
                                <td>{details.collectionEnds}</td>
                            </tr>
                            <tr>
                                <td>Status</td>
                                <td>{details.projectStatus?.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}</td>
                            </tr>
                            <tr>
                                <td>Partner</td>
                                <td>{details.ProjectPartners?.User.fullName}</td>
                            </tr>
                            <tr>
                                <td>Created By</td>
                                <td>{details.CreatedBy?.fullName}</td>
                            </tr>
                            <tr>
                                <td>Summary</td>
                                <td dangerouslySetInnerHTML={{ __html: details.summary }}></td>
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