/* eslint-disable @next/next/no-img-element */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect } from "react";
import MainLayout from "@/layouts/MainLayout";
import { useRouter } from "next/router";
import { getRequestOptions, postRequestOptions } from "@/utils/Fetch";
import { Container, Row, Table, Col, Tab, Tabs, Button } from "react-bootstrap";
import Swal from "sweetalert2";
import Image from "next/image";
import { S3_URL } from '@/config/constants';
import Carousel from 'react-bootstrap/Carousel';
import { API_URL } from '@/config/constants';

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
    showInUpcoming: string,
    ProjectCategory: {
        categoryName: string
    }
    ProjectPartners: {
        User: {
            idUsers: number,
            fullName: string,
            phoneNumber: string,
            joiningDate: string,
            ProfilePicture: {
                idFiles: number,
                originalFileName: string,
                fileName: string
            }
        }
    }[],
    ProjectInvestors: {
        ProjectInvestmentBooking: {
            idProjectInvestmentBooking: number,
            bookingId: string,
            paymentConfirmationStatus: string,
        },
        User: {
            idUsers: number,
            fullName: string,
            phoneNumber: string
        },
        investmentDate: string,
        unitPurchased: number
    }[],
    CreatedBy: {
        fullName: string
    },
    MainImage?: {
        idFiles: number,
        originalFileName: string,
        fileName: string,
    },
    FeaturedImages: {
        idFiles: number,
        originalFileName: string,
        fileName: string,
    }[]
}

function Details() {
    const router = useRouter();
    const { id } = router.query;
    const [details, setDetails] = useState<DetailsProps>({} as DetailsProps);
    const [reload, setReload] = useState<boolean>(false);

    useEffect(() => {
        if (id != undefined) {
            fetchProjectDetails();
        }
    }, [id])

    useEffect(() => {
        if (reload) {
            fetchProjectDetails();
        }
    }, [reload])

    const fetchProjectDetails = async () => {
        try {
            const res = await fetch('/api/projects/details/' + id, getRequestOptions());
            const data = await res.json();
            if (res.status === 200) {
                setDetails(data.data);
                setReload(false);
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

    const projectStatusChange = async (status: string) => {
        Swal.fire({
            title: 'Are you sure?',
            text: "You want to change status of this project!",
            icon: 'warning',
            showCancelButton: true,
            cancelButtonText: 'No',
            confirmButtonText: 'Yes'
        }).then((result) => {
            if (result.value) {
                try {
                    const fetchData = async () => {
                        const res = await fetch(API_URL + 'api/projects/status_change', postRequestOptions({ id: id, status: status }));
                        if (res.status === 200) {
                            Swal.fire({
                                icon: 'success',
                                title: 'Success',
                                text: 'Project status changed successfully!',
                            });
                            setReload(true);
                        } else {
                            Swal.fire({
                                icon: 'error',
                                title: 'Error',
                                html: (await res.json()).message,
                            });
                        }
                    };
                    fetchData();

                } catch (err) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: 'Something went wrong!',
                    });
                }
            }
        });
    }


    return (
        <Container>
            <h4 className="text-start"> Project Details</h2>
            <hr />
            <Tabs defaultActiveKey="details" id="uncontrolled-tab-example" className="mb-3">
                <Tab eventKey="details" title="Details">
                    <Row>
                        <Col md={6}>
                            <Table bordered>
                                <tbody>
                                    <tr>
                                        <td>Project Name</td>
                                        <td>{details.projectName}</td>
                                    </tr>
                                    <tr>
                                        <td>Category</td>
                                        <td>{details.ProjectCategory?.categoryName}</td>
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
                                    <tr>
                                        <td>Main Image</td>
                                        <td className="text-center">
                                            {details.MainImage && <Image src={`${S3_URL}project-main-image/${id}/${details.MainImage?.fileName}`} alt={details.MainImage?.originalFileName} width={100} height={100} />}
                                        </td>
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
                                        <td>Other Locations</td>
                                        <td>{details.otherLocations}</td>
                                    </tr>
                                    <tr>
                                        <td>Status</td>
                                        <td>{details.projectStatus?.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}</td>
                                    </tr>
                                    <tr>
                                        <td>Upcoming</td>
                                        <td>{details.showInUpcoming?.charAt(0).toUpperCase() + details.showInUpcoming?.slice(1)}</td>
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
                </Tab>
                <Tab eventKey="partners" title="Partners">
                    <Row>
                        <Table bordered>
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Profile Picture</th>
                                    <th>Name</th>
                                    <th>Phone Number</th>
                                    <th>Joining Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                {details?.ProjectPartners?.length > 0 ? details.ProjectPartners.map((partner, index) => (
                                    <tr key={index}>
                                        <td>{index + 1}</td>
                                        <td className="text-center">
                                            {partner.User.ProfilePicture !== null && <Image src={`${S3_URL}profile-picture/${partner.User.idUsers}/${partner.User.ProfilePicture?.fileName}`} alt={partner.User.ProfilePicture?.originalFileName} width={100} height={100} />}
                                        </td>
                                        <td>{partner.User.fullName}</td>
                                        <td>{partner.User.phoneNumber}</td>
                                        <td>{partner.User.joiningDate}</td>
                                    </tr>
                                )) : <tr><td colSpan={5} className="text-center">No Partners Found</td></tr>}
                            </tbody>
                        </Table>
                    </Row>
                </Tab>
                <Tab eventKey="Bookings" title="Bookings">
                    <Row>
                        <Table bordered>
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Booking ID</th>
                                    <th>Investor Name</th>
                                    <th>Phone Number</th>
                                    <th>Investment Date</th>
                                    <th>Unit Purchased</th>
                                    <th>Payment Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {details?.ProjectInvestors?.length > 0 ? details.ProjectInvestors.map((investor, index) => (
                                    <tr key={index}>
                                        <td>{index + 1}</td>
                                        <td>{investor.ProjectInvestmentBooking.bookingId}</td>
                                        <td>{investor.User.fullName}</td>
                                        <td>{investor.User.phoneNumber}</td>
                                        <td>{investor.investmentDate}</td>
                                        <td>{investor.unitPurchased}</td>
                                        <td>{investor.ProjectInvestmentBooking.paymentConfirmationStatus}</td>
                                    </tr>
                                )) : <tr><td colSpan={7} className="text-center">No Bookings Found</td></tr>}
                            </tbody>
                        </Table>
                    </Row>
                </Tab>
                <Tab eventKey="featured-images" title="Featured Images">
                    <Row>
                        <Col>
                            <Carousel>
                                {details.FeaturedImages && details.FeaturedImages.map((image, index) => (
                                    <Carousel.Item key={index}>
                                        <img src={`${S3_URL}project-featured-image/${id}/${image.fileName}`} alt={image.originalFileName} style={{ maxHeight: '50vh', maxWidth: "100%" }} />
                                    </Carousel.Item>
                                ))}
                            </Carousel>
                        </Col>
                    </Row>
                </Tab>
            </Tabs>
            {details.projectStatus === 'created' &&
                <Row className='justify-content-center mt-3'>
                    <Button className='w-50' variant="primary" onClick={() => projectStatusChange('completed')}>
                        Complete
                    </Button>
                </Row>
            }
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