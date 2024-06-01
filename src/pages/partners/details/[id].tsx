import React, { useState, useEffect } from "react";
import MainLayout from "@/layouts/MainLayout";
import { useRouter } from "next/router";
import { getRequestOptions } from "@/utils/Fetch";
import { Container, Row, Table, Col } from "react-bootstrap";
import Image from "next/image";
import Carousel from 'react-bootstrap/Carousel';
import {S3_URL} from '@/config/constants';

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
    bio: string,
    education: string,
    ProfilePicture?:{
        idFiles: number,
        originalFileName:string,
        fileName:string,
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
                                <td>Education</td>
                                <td>{details.education}</td>
                            </tr>
                            <tr>
                                <td>Profile Picture</td>
                                <td className="text-center">
                                    {details.ProfilePicture && <Image src={`${S3_URL}profile-picture/${id}/${details.ProfilePicture?.fileName}`} alt={details.ProfilePicture?.originalFileName} width={100} height={100} />}
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
                                <td>Bio</td>
                                <td dangerouslySetInnerHTML={{ __html: details.bio }}></td>
                            </tr>
                        </tbody>
                    </Table>
                </Col>
            </Row>
            <Row className="mt-2">
            <h3>Featured Images</h3>
                <Col>
                    <Carousel>
                        {details.FeaturedImages && details.FeaturedImages.map((image, index) => (
                            <Carousel.Item key={index}>
                                <Image src={`${S3_URL}featured-image/${id}/${image.fileName}`} alt={image.originalFileName} width={1200} height={400} />
                            </Carousel.Item>
                        ))}
                    </Carousel>
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
