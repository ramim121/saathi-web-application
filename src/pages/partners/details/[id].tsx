import React, { useState, useEffect } from "react";
import MainLayout from "@/layouts/MainLayout";
import { useRouter } from "next/router";
import { getRequestOptions } from "@/utils/Fetch";
import { Container, Row, Table, Col, Tab, Tabs } from "react-bootstrap";
import Carousel from 'react-bootstrap/Carousel';
import { S3_URL } from '@/config/constants';
import Swal from "sweetalert2";
import Link from "next/link";

interface DetailsProps {
    idUsers: number,
    fullName: string,
    phoneNumber: string,
    age: number,
    location: string,
    disability: string,
    role: string,
    joiningDate: string,
    skills: string,
    interestedIn: string,
    bio: string,
    education: string,
    partnerType: string,
    Partnerships?: {
        Project: {
            projectName: string,
            location: string,
            idProjects: number,
            MainImage: {
                idFiles: number,
                originalFileName: string,
                fileName: string,
            }
        },
        ProjectPartnerInvestors: {
            ProjectInvestor: {
                ProjectInvestmentBooking: {
                    bookingId: string,
                    idProjectInvestmentBookings: number
                }
            }
        }[],
        partnerUnitCapacity: number,
        alreadyInvestedUnits: number
    }[],
    ProfilePicture?: {
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

    useEffect(() => {
        if (id != undefined) {
            const fetchPartnerDetails = async () => {
                try {
                    const res = await fetch('/api/partners/details/' + id, getRequestOptions());
                    const data = await res.json();
                    if (res.status === 200) {
                        setDetails(data.data);
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
            fetchPartnerDetails();
        }
    }, [id])

    return (
        <Container>
            <h4 className="text-start"> Partner Details ({details?.fullName})</h4>
            <hr />
            <Tabs defaultActiveKey="details" id="uncontrolled-tab-example" className="mb-3">
                <Tab eventKey="details" title="Details">
                    <Row>
                        <Col md={6}>
                            <Table bordered>
                                <tbody>
                                    <tr>
                                        <td>Full Name</td>
                                        <td>{details?.fullName}</td>
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
                                        <td>Location/Address</td>
                                        <td>{details.location}</td>
                                    </tr>
                                    <tr>
                                        <td>Disability</td>
                                        <td>{details.disability?.charAt(0).toUpperCase() + details.disability?.slice(1)}</td>
                                    </tr>
                                    <tr>
                                        <td>Education</td>
                                        <td>{details.education}</td>
                                    </tr>
                                    <tr>
                                        <td>Profile Picture</td>
                                        <td className="text-center">
                                            {details.ProfilePicture && <img src={`${S3_URL}profile-picture/${id}/${details.ProfilePicture?.fileName}`} alt={details.ProfilePicture?.originalFileName} width={100} height={100} />}
                                        </td>
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
                                        <td>Partner Type</td>
                                        <td>{details.partnerType?.charAt(0).toUpperCase() + details.partnerType?.slice(1)}</td>
                                    </tr>
                                    <tr>
                                        <td>Bio</td>
                                        <td>{details.bio}</td>
                                    </tr>
                                </tbody>
                            </Table>
                        </Col>
                    </Row>
                </Tab>
                <Tab eventKey="projects" title="Projects">
                    <Table bordered>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Main Image</th>
                                <th>Project Name</th>
                                <th>Location</th>
                                <th>Unit Capacity</th>
                                <th>Already Invested</th>
                                <th>Booking Id</th>
                            </tr>
                        </thead>
                        <tbody>
                            {details.Partnerships && details.Partnerships.map((project, index) => (
                                <tr key={index}>
                                    <td>{index + 1}</td>
                                    <td>
                                        <img src={`${S3_URL}project-main-image/${project.Project.idProjects}/${project.Project?.MainImage?.fileName}`} alt={project.Project?.MainImage?.originalFileName} width={100} height={100} loading="lazy" />
                                    </td>
                                    <td>{project.Project?.projectName}</td>
                                    <td>{project.Project?.location}</td>
                                    <td>{project.partnerUnitCapacity}</td>
                                    <td>{project.alreadyInvestedUnits}</td>
                                    <td>
                                        {project.ProjectPartnerInvestors!
                                            .map((investor, i, array) => {
                                                const bookingId = investor?.ProjectInvestor?.ProjectInvestmentBooking?.bookingId;
                                                const bookingUrl = `/bookings/details/${investor?.ProjectInvestor?.ProjectInvestmentBooking?.idProjectInvestmentBookings}`;
                                                if (bookingId) {
                                                    return (
                                                        <span key={bookingId}>
                                                            <Link href={bookingUrl} target="_blank" rel="noopener noreferrer">
                                                                {bookingId}
                                                            </Link>
                                                            {i < array.length - 1 && ', '} {/* Add a comma except after the last item */}
                                                        </span>
                                                    );
                                                }
                                                return null;
                                            })
                                            .filter(Boolean)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </Table>
                </Tab>
                <Tab eventKey="featured-images" title="Featured Images">
                    <Col>
                        <Carousel>
                            {details.FeaturedImages && details.FeaturedImages.map((image, index) => (
                                <Carousel.Item key={index}>
                                    <img src={`${S3_URL}featured-image/${id}/${image.fileName}`} alt={image.originalFileName} width={1200} height={400} />
                                </Carousel.Item>
                            ))}
                        </Carousel>
                    </Col>
                </Tab>
            </Tabs>
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
