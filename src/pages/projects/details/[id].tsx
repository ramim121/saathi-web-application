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
import { GetServerSidePropsContext } from "next";
import { Project, ProjectCategory, ProjectPartner, User, File, ProjectInvestmentBooking, ProjectInvestor, ProjectPartnerInvestor } from "@/models/__associations";
import sequelize from "@/config/db";
import ProjectType from "@/types/Project";
import { getProjectDetails } from "@/pages/api/projects/details/[id]";

interface ProjectDetailsProps {
    projectDataMain: ProjectType
}


const Details = ({ projectDataMain }: ProjectDetailsProps) => {

    const [projectData, setProjectData] = useState<ProjectType>(projectDataMain);
    const router = useRouter();
    const { id } = router.query;
    const [reload, setReload] = useState<boolean>(false);
    console.log(projectData);

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
                setProjectData(data.data);
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
            <h4 className="text-start"> Project Details ({projectData.projectName})</h4>
            <hr />
            <Tabs defaultActiveKey="details" id="uncontrolled-tab-example" className="mb-3">
                <Tab eventKey="details" title="Details">
                    <Row>
                        <Col md={6}>
                            <Table bordered size="sm">
                                <tbody>
                                    <tr>
                                        <td>Project Name</td>
                                        <td>{projectData.projectName}</td>
                                    </tr>
                                    <tr>
                                        <td>Category</td>
                                        <td>{projectData.ProjectCategory?.categoryName}</td>
                                    </tr>
                                    <tr>
                                        <td>Location</td>
                                        <td>{projectData.location}</td>
                                    </tr>
                                    <tr>
                                        <td>Share / Unit</td>
                                        <td>{projectData.unitInvestmentValue}</td>
                                    </tr>
                                    <tr>
                                        <td> Investment Type</td>
                                        <td>{projectData.investmentType?.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}</td>
                                    </tr>
                                    <tr>
                                        <td>Return Type</td>
                                        <td>{projectData.returnType}</td>
                                    </tr>
                                    <tr>
                                        <td>Return</td>
                                        <td>{projectData.returnRangeMin}% - {projectData.returnRangeMax}%</td>
                                    </tr>
                                    <tr>
                                        <td>Amount</td>
                                        <td>{projectData.totalReturnMin} - {projectData.totalReturnMax}</td>
                                    </tr>
                                    <tr>
                                        <td>Tenure</td>
                                        <td>{projectData.duration} {projectData.tenure}</td>
                                    </tr>
                                    <tr>
                                        <td>Total Available Units</td>
                                        <td>{projectData.totalAvailableUnits}</td>
                                    </tr>
                                    <tr>
                                        <td>Investor Unit Capacity</td>
                                        <td>{projectData.investorUnitCapacity}</td>
                                    </tr>
                                    <tr>
                                        <td>Main Image</td>
                                        <td className="text-center">
                                            {projectData.MainImage && <img src={`${S3_URL}project-main-image/${id}/${projectData.MainImage?.fileName}`} alt={projectData.MainImage?.originalFileName} width="200" />}
                                        </td>
                                    </tr>
                                </tbody>
                            </Table>
                        </Col>
                        <Col md={6}>
                            <Table bordered size="sm">
                                <tbody>
                                    <tr>
                                        <td width={"30%"}>Collection Starts</td>
                                        <td>{projectData.collectionStarts}</td>
                                    </tr>
                                    <tr>
                                        <td>Collection Ends</td>
                                        <td>{projectData.collectionEnds}</td>
                                    </tr>
                                    <tr>
                                        <td>Other Locations</td>
                                        <td>{projectData.otherLocations}</td>
                                    </tr>
                                    <tr>
                                        <td>Status</td>
                                        <td>{projectData.projectStatus?.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}</td>
                                    </tr>
                                    <tr>
                                        <td>Upcoming</td>
                                        <td>{projectData.showInUpcoming?.charAt(0).toUpperCase() + projectData.showInUpcoming?.slice(1)}</td>
                                    </tr>
                                    <tr>
                                        <td>Created By</td>
                                        <td>{projectData.CreatedBy?.fullName}</td>
                                    </tr>
                                    <tr>
                                        <td>Summary</td>
                                        <td dangerouslySetInnerHTML={{ __html: projectData.summary || "" }}></td>
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
                                    <th>Unit Capacity</th>
                                </tr>
                            </thead>
                            <tbody>
                                {projectData.ProjectPartners!.length > 0 ? projectData.ProjectPartners!.map((partner, index) => (
                                    <tr key={index}>
                                        <td>{index + 1}</td>
                                        <td className="text-center">
                                            {partner.User!.ProfilePicture !== null && <img src={`${S3_URL}profile-picture/${partner.User!.idUsers}/${partner.User!.ProfilePicture?.fileName}`} alt={partner.User!.ProfilePicture?.originalFileName || ""} width={100} height={100} />}
                                        </td>
                                        <td>{partner.User!.fullName}</td>
                                        <td>{partner.User!.phoneNumber}</td>
                                        <td>{(new Date(partner.User!.joiningDate!)).toLocaleDateString()}</td>
                                        <td>{partner.partnerUnitCapacity}</td>
                                    </tr>
                                )) : <tr><td colSpan={6} className="text-center">No Partners Found</td></tr>}
                            </tbody>
                        </Table>
                    </Row>
                </Tab>
                <Tab eventKey="Bookings" title="Investors">
                    <Row>
                        <Col>
                            <Table size="sm">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Booking ID</th>
                                        <th>Proof or payment</th>
                                        <th></th>
                                        <th>Investor</th>
                                        <th>Investment Status</th>
                                        <th>Phone Number</th>
                                        <th colSpan={3} className="text-center">Partner info</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {
                                        projectData.ProjectInvestors!.map((investor, index) => {
                                            return (
                                                <tr key={index}>
                                                    <td>{investor.idProjectInvestors}</td>
                                                    <td>
                                                        <a href={"/bookings/details/" + investor.ProjectInvestmentBooking.idProjectInvestmentBookings}>
                                                            {investor.ProjectInvestmentBooking.bookingId}
                                                        </a>
                                                    </td>
                                                    <td>{investor.ProjectInvestmentBooking.paymentConfirmationStatus}</td>
                                                    <td className="text-center">
                                                        {investor.User!.profileImage !== null && <img src={`${S3_URL}profile-picture/${investor.User!.profileImage}`} alt={""} width={35} height={35} />}
                                                    </td>
                                                    <td>{investor.User!.fullName}</td>
                                                    <td>{investor.User!.phoneNumber}</td>
                                                    <td>{investor.investmentStatus}</td>
                                                    <td className="p-0 m-0">
                                                        <Table className="m-0 table-borderless">
                                                            <tbody>
                                                                {
                                                                    investor.ProjectPartnerInvestors!.map((partnerInvestor, index) => {
                                                                        return (
                                                                            <tr key={index}>
                                                                                <td>{partnerInvestor.ProjectPartner!.User!.fullName}</td>
                                                                                <td>{partnerInvestor.investedUnit} unit</td>
                                                                                <td className="text-end">{Number(partnerInvestor.amountInvested).toLocaleString()}</td>
                                                                            </tr>
                                                                        )
                                                                    })
                                                                }
                                                            </tbody>
                                                        </Table>
                                                    </td>
                                                </tr>
                                            )
                                        })
                                    }
                                </tbody>
                            </Table>
                        </Col>
                    </Row>
                </Tab>
                <Tab eventKey="featured-images" title="Featured Images">
                    <Row>
                        <Col>
                            <Carousel>
                                {projectData.FeaturedImages && projectData.FeaturedImages.map((image, index) => (
                                    <Carousel.Item key={index}>
                                        <img src={`${S3_URL}project-featured-image/${id}/${image.fileName}`} alt={image.originalFileName} style={{ maxHeight: '50vh', maxWidth: "100%" }} />
                                    </Carousel.Item>
                                ))}
                            </Carousel>
                        </Col>
                    </Row>
                </Tab>
            </Tabs>
            {projectData.projectStatus === 'created' &&
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

export async function getServerSideProps(context: GetServerSidePropsContext) {
    const projectId = context.params?.id;

    const projectData = await getProjectDetails(projectId as string);

    return {
        props: {
            projectDataMain: JSON.parse(JSON.stringify(projectData))
        }
    }
}