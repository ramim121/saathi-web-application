/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect } from 'react';
import { useRouter } from "next/router";
import MainLayout from "@/layouts/MainLayout";
import { Container, Row, Col, Table, Button, Modal, Form } from "react-bootstrap";
import { getRequestOptions, putRequestOptions } from "@/utils/Fetch";
import Swal from "sweetalert2";
import { S3_URL } from '@/config/constants';
import Image from "next/image";
import { API_URL } from '@/config/constants';
import Select from 'react-select';


interface DetailsProps {
    idProjectInvestmentBookings: number;
    bookingId: string;
    User: {
        fullName: string;
        phoneNumber: string;
    },
    paymentConfirmationStatus: string;
    UserBank: {
        Bank: {
            bankNameFull: string;
        },
        accountNumber: string;
        accountHolderName: string;

    },
    proofOfPayment: string | null;
    paymentMethod: string;
    paymentDate: string;
    paymentAmount: number;
    transactionId: string;
    ProjectInvestors: {
        Project: {
            projectName: string;
        };
        unitPurchased: number;
        investmentDate: string;
        investmentStatus: string;
        ProjectPartnerInvestors: {
            ProjectPartner: {
                User: {
                    fullName: string;
                };
            };
            amountInvested: number;
        }[];
        idProjectInvestors: number;
    }[];


}

interface FormDataProps {
    bookingId: string;
    paymentMethod: {
        value: string;
        label: string;
    };
    paymentDate: string;
    paymentAmount: number;
    transactionId: string;
}

function Details() {
    const router = useRouter();
    const { id } = router.query;
    const [details, setDetails] = useState<DetailsProps>({} as DetailsProps);
    const [reload, setReload] = useState<boolean>(false);
    const [approverModalShow, setApproverModalShow] = useState<boolean>(false);
    const [formData, setFormData] = useState<FormDataProps>({
        bookingId: '',
        paymentMethod: {
            value: '',
            label: ''
        },
        paymentDate: '',
        paymentAmount: 0,
        transactionId: ''
    });

    useEffect(() => {
        if (id != undefined) {
            fetchPartnerDetails();
        }
    }, [id])

    useEffect(() => {
        if (reload === true) {
            fetchPartnerDetails();
        }
    }, [reload])

    const fetchPartnerDetails = async () => {
        try {
            const res = await fetch('/api/bookings/details/' + id, getRequestOptions());
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

    const handleOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData({
            ...formData,
            [name]: value
        });
    }

    const handleDeny = async (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        e.preventDefault();
        Swal.fire({
            title: 'Are you sure?',
            text: "You want to deny this booking!",
            icon: 'warning',
            showCancelButton: true,
            cancelButtonText: 'No',
            confirmButtonText: 'Yes'
        }).then((result) => {
            if (result.value) {
                try {
                    const fetchData = async () => {
                        const formData = {
                            bookingId: details.bookingId,
                            paymentConfirmationStatus: 'denied'
                        }
                        const res = await fetch(API_URL + `api/bookings/deny`, putRequestOptions(formData));
                        if (res.status === 200) {
                            Swal.fire({
                                icon: 'success',
                                title: 'Success',
                                text: 'Booking denied successfully!',
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
        })
    }

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        try {
            const fetchData = async () => {
                formData.bookingId = details.bookingId;
                const res = await fetch(API_URL + `api/bookings/approve`, putRequestOptions(formData));
                if (res.status === 200) {
                    Swal.fire({
                        icon: 'success',
                        title: 'Success',
                        text: 'Booking approved successfully!',
                    });
                    setReload(true);
                    setApproverModalShow(false);
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

    const handleInvestmentStatusChange = async (idProjectInvestors: number, investmentStatus: string) => {
        Swal.fire({
            title: 'Are you sure?',
            text: "You want to change status of this investment!",
            icon: 'warning',
            showCancelButton: true,
            cancelButtonText: 'No',
            confirmButtonText: 'Yes'
        }).then((result) => {
            if (result.value) {
                try {
                    const fetchData = async () => {
                        const formData = {
                            idProjectInvestors,
                            investmentStatus
                        }
                        const res = await fetch(API_URL + 'api/bookings/investment_status_change', putRequestOptions(formData));
                        if (res.status === 200) {
                            Swal.fire({
                                icon: 'success',
                                title: 'Success',
                                text: 'Investment status changed successfully!',
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
            <h4 className="text-start"> Booking Details</h4>
            <hr />
            <Row>
                <Col md={6}>
                    <Table bordered size='sm'>
                        <tbody>
                            <tr>
                                <td>Booking ID</td>
                                <td>{details.bookingId}</td>
                            </tr>
                            <tr>
                                <td>Investor </td>
                                <td>{details.User?.fullName} ( {details.User?.phoneNumber} )</td>
                            </tr>
                            <tr>
                                <td>Payment Confirmation Status</td>
                                <td>
                                    {details.paymentConfirmationStatus?.charAt(0).toUpperCase() + details.paymentConfirmationStatus?.slice(1)}
                                </td>
                            </tr>
                            <tr>
                                <td>Investor Bank</td>
                                <td>
                                    {details.UserBank?.Bank.bankNameFull}
                                </td>
                            </tr>
                            <tr>
                                <td>Account Number</td>
                                <td>
                                    {details.UserBank?.accountNumber}
                                </td>
                            </tr>
                            <tr>
                                <td>Account Holder Name</td>
                                <td>
                                    {details.UserBank?.accountHolderName}
                                </td>
                            </tr>

                        </tbody>
                    </Table>
                </Col>
                <Col md={6}>
                    <Table bordered size='sm'>
                        <tbody>
                            <tr>
                                <td>Proof of Payment</td>
                                <td>
                                    {details.proofOfPayment !== null && (
                                        <a className='btn btn-secondary btn-sm text-light w-100' href={`${S3_URL}proof-of-payment/${details.proofOfPayment}`} target="_blank" rel="noopener noreferrer">
                                            View
                                        </a>
                                    )}
                                </td>
                            </tr>
                            <tr>
                                <td>Payment Method</td>
                                <td>
                                    {details.paymentMethod?.charAt(0).toUpperCase() + details.paymentMethod?.slice(1)}
                                </td>
                            </tr>
                            <tr>
                                <td>Payment Date</td>
                                <td>
                                    {details.paymentDate}
                                </td>
                            </tr>
                            <tr>
                                <td>Payment Amount</td>
                                <td>
                                    {details.paymentAmount.toLocaleString()}
                                </td>
                            </tr>
                            <tr>
                                <td>Transaction ID</td>
                                <td>
                                    {details.transactionId}
                                </td>
                            </tr>
                        </tbody>
                    </Table>
                </Col>
            </Row>
            <Row>
                <Col md={12}>
                    <Table size='sm' bordered>
                        <thead>
                            <tr>
                                <th>Sl</th>
                                <th>Investment Date</th>
                                <th>Projects</th>
                                <th>Unit Purchased</th>
                                <th>Project Partners</th>
                                <th>Unit Price</th>
                                <th>Total Amount</th>
                                <th>Investment Status</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {details.ProjectInvestors && details.ProjectInvestors.map((project, index) => (
                                <tr key={index}>
                                    <td>{index + 1}</td>
                                    <td>{project.investmentDate}</td>

                                    <td>{project.Project.projectName}</td>
                                    <td>{project.unitPurchased}</td>
                                    <td>
                                        <ul>
                                            {project.ProjectPartnerInvestors.map((partner, index) => (
                                                <li key={index}>{partner.ProjectPartner.User.fullName}</li>
                                            ))
                                            }
                                        </ul>
                                    </td>
                                    <td>
                                        {project.ProjectPartnerInvestors[0].amountInvested}
                                    </td>
                                    <td>
                                        {project.ProjectPartnerInvestors.reduce((acc, curr) => Number(acc) + Number(curr.amountInvested), 0)}
                                    </td>
                                    <td>{project.investmentStatus?.charAt(0).toUpperCase() + project.investmentStatus?.slice(1)}</td>
                                    <td>
                                        {project.investmentStatus === 'booked' &&
                                            <Button size='sm' variant="danger" type="submit" onClick={() => handleInvestmentStatusChange(project.idProjectInvestors, 'cancelled')}>
                                                Cancel
                                            </Button>
                                        }
                                    </td>
                                </tr>
                            ))}

                        </tbody>
                        <tfoot>
                            <tr>
                                <td colSpan={6} style={{ textAlign: 'right' }}>
                                    <strong> Total Payable Amount:</strong>
                                </td>
                                <td>
                                    {details.ProjectInvestors && details.ProjectInvestors.reduce((acc, curr) => Number(acc) + curr.ProjectPartnerInvestors.reduce((acc, curr) => Number(acc) + Number(curr.amountInvested), 0), 0)}
                                </td>
                                <td colSpan={2}></td>
                            </tr>
                        </tfoot>
                    </Table>
                </Col>
            </Row>
            {details.paymentConfirmationStatus === 'uploaded' &&
                <Row className='justify-content-center'>
                    <Col md={4}></Col>
                    <Col md={4}>
                        <Button className='w-50' variant="primary" type="submit" onClick={() => setApproverModalShow(true)}>
                            Approve
                        </Button>
                        <Button className='w-50' variant="danger" type="submit" onClick={handleDeny}>
                            Deny
                        </Button>
                    </Col>
                    <Col md={4}></Col>
                </Row>
            }

            <Modal show={approverModalShow} onHide={() => setApproverModalShow(false)} >
                <Modal.Header closeButton>
                    <Modal.Title>Approve Booking</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form onSubmit={handleSubmit}>
                        <Form.Group as={Row} className='mb-3'>
                            <Form.Label column sm='4'>Payment Method <span className='text-danger'>*</span></Form.Label>
                            <Col sm='8'>
                                <Select
                                    id="paymentMethod"
                                    instanceId="paymentMethod"
                                    options={[
                                        { value: 'bank', label: 'Bank' },
                                        { value: 'cash', label: 'Cash' },
                                        { value: 'card', label: 'Card' },
                                        { value: 'mobile', label: 'Mobile' }
                                    ]}
                                    value={formData.paymentMethod}
                                    onChange={(selectedOption: any) => setFormData({ ...formData, paymentMethod: selectedOption })}
                                />
                            </Col>
                        </Form.Group>
                        <Form.Group as={Row} className='mb-3'>
                            <Form.Label column sm='4'>Payment Date <span className='text-danger'>*</span></Form.Label>
                            <Col sm='8'>
                                <Form.Control type='date' name='paymentDate' value={formData.paymentDate} onChange={handleOnChange} />
                            </Col>
                        </Form.Group>
                        <Form.Group as={Row} className='mb-3'>
                            <Form.Label column sm='4'>Payment Amount <span className='text-danger'>*</span></Form.Label>
                            <Col sm='8'>
                                <Form.Control type='number' name='paymentAmount' value={formData.paymentAmount} onChange={handleOnChange} />
                            </Col>
                        </Form.Group>
                        <Form.Group as={Row} className='mb-3'>
                            <Form.Label column sm='4'>Transaction ID <span className='text-danger'>*</span></Form.Label>
                            <Col sm='8'>
                                <Form.Control type='text' name='transactionId' value={formData.transactionId} onChange={handleOnChange} />
                            </Col>
                        </Form.Group>
                        <Row className='justify-content-center'>
                            <Button className='w-50 mt-2' variant="primary" type="submit">
                                Submit
                            </Button>
                        </Row>
                    </Form>
                </Modal.Body>
            </Modal>
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
