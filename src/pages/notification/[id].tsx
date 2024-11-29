/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect } from 'react';
import { useRouter } from "next/router";
import MainLayout from "@/layouts/MainLayout";
import { Container, Row, Col, Table } from "react-bootstrap";
import { getRequestOptions } from "@/utils/Fetch";
import Swal from "sweetalert2";
import { S3_URL } from '@/config/constants';
import Image from 'next/image';

interface DetailsProps {
    idManualNotifications: number;
    User: {
        fullName: string;
    },
    emailBody: string;
    emailSubject: string;
    pushNotificationBody: string;
    pushNotificationImage: string;
    pushNotificationTitle: number;
    formattedSendOn: string;
    sendViaEmail: string;
    sendViaPush: string;
    sendViaSms: string;
    smsBody: string;
}

function Details() {
    const router = useRouter();
    const { id } = router.query;
    const [details, setDetails] = useState<DetailsProps>({} as DetailsProps);

    useEffect(() => {
        if (id != undefined) {
            fetchManualNotificationDetails();
        }
    }, [id]);

    const fetchManualNotificationDetails = async () => {
        try {
            const res = await fetch('/api/manual-notification/details/' + id, getRequestOptions());
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


    return (
        <Container>
            <h4 className="text-start"> Manual Notification Details</h4>
            <hr />
            <Row>
                <Col md={6}>
                    <Table bordered size='sm'>
                        <tbody>
                            <tr>
                                <td>Send Via Sms</td>
                                <td>{details.sendViaSms?.charAt(0).toUpperCase() + details.sendViaSms?.slice(1)}</td>
                            </tr>
                            {details.sendViaSms === 'yes' &&
                                <tr>
                                    <td>Sms Body </td>
                                    <td>{details.smsBody}</td>
                                </tr>
                            }
                            <tr>
                                <td>Send Via Email</td>
                                <td>{details.sendViaEmail?.charAt(0).toUpperCase() + details.sendViaEmail?.slice(1)}</td>
                            </tr>
                            {details.sendViaEmail === 'yes' &&
                                <>
                                    <tr>
                                        <td>Email Subject</td>
                                        <td>
                                            {details.emailSubject}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>Email Body</td>
                                        <td dangerouslySetInnerHTML={{ __html: details.emailBody }}>
                                        </td>
                                    </tr>
                                </>
                            }
                            <tr>
                                <td>Send Via Push</td>
                                <td>{details.sendViaPush?.charAt(0).toUpperCase() + details.sendViaPush?.slice(1)}</td>
                            </tr>
                            {details.sendViaPush === 'yes' &&
                                <>
                                    <tr>
                                        <td>Push Notification Title</td>
                                        <td>{details.pushNotificationTitle}</td>
                                    </tr>
                                    <tr>
                                        <td>Push Notification Body</td>
                                        <td>{details.pushNotificationBody}</td>
                                    </tr>
                                    {details.pushNotificationImage !== null &&
                                        <tr>
                                            <td>Push Notification Image</td>
                                            <td>
                                                <Image src={`${S3_URL}push-notification/${details.pushNotificationImage}`} alt="Push Notification Image" width={100} height={100} />
                                            </td>
                                        </tr>
                                    }
                                </>
                            }
                            <tr>
                                <td>Send On</td>
                                <td>{details.formattedSendOn}</td>
                            </tr>
                            <tr>
                                <td>Created By</td>
                                <td>{details.User?.fullName}</td>
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
