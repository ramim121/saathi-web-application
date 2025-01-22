/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from "next/router";
import MainLayout from "@/layouts/MainLayout";
import { Container, Row, Col, Table, Button, Modal, Form, DropdownButton, Dropdown, ButtonGroup, Tabs, Tab } from "react-bootstrap";
import { getRequestOptions, putRequestOptions } from "@/utils/Fetch";
import Swal from "sweetalert2";
import { S3_URL } from '@/config/constants';
import Image from "next/image";
import { API_URL } from '@/config/constants';
import Select from 'react-select';
import { getCookie } from '@/utils/GetCookie';
import { ChatDots, List, GraphUp, FileEarmarkText, HandThumbsUp, House, Calendar, Rulers } from 'react-bootstrap-icons';

interface DetailsProps {
    idProjectInvestmentBookings: number;
    idUsers: number;
    bookingId: string;
    cancelled: string;
    idUserBanks: number;
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
    collectionRequired: string;
    collectionDate: string;
    collectionLocation: string;
    collectionStatus: string;
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
    collectionDate?: string;
    collectionLocation?: string;
    idUserBanks?: number;
}

interface TimelineItemProps {
    icon: React.ReactNode;
    color: string;
    header: string;
    description: string;
}

interface UserBanksProps {
    idUserBanks: number;
    idUsers: number;
    idBanks: number;
    idBankBranches: number;
    accountNumber: string;
    accountHolderName: string;
    default: string;
    Bank: {
        bankNameFull: string;
    };
    BankBranch: {
        branchName: string;
    };
}

function Details() {
    const router = useRouter();
    const { id } = router.query;
    const [details, setDetails] = useState<DetailsProps>({} as DetailsProps);
    const [reload, setReload] = useState<boolean>(false);
    const [approverModalShow, setApproverModalShow] = useState<boolean>(false);
    const [proofOfPaymentFile, setProofOfPaymentFile] = useState<File | null>(null);
    const [formData, setFormData] = useState<FormDataProps>({
        bookingId: '',
        paymentMethod: {
            value: '',
            label: ''
        },
        paymentDate: '',
        paymentAmount: 0,
        transactionId: '',

    });
    const [userBanks, setUserBanks] = useState<UserBanksProps[]>([]);
    const proofOfPaymentRef = useRef<HTMLInputElement>(null);
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

    useEffect(() => {
        if (details !== undefined) {
            setFormData({
                bookingId: details.bookingId,
                paymentMethod: {
                    value: details.paymentMethod,
                    label: details.paymentMethod === 'cheque' ? 'Cheque' : details.paymentMethod === 'beftn' ? 'BEFTN' : details.paymentMethod === 'rtgs' ? 'RTGS' : details.paymentMethod === 'npsb' ? 'NPSB' : 'Cash'
                },
                paymentDate: details.paymentDate,
                paymentAmount: details.paymentAmount,
                transactionId: details.transactionId,
                collectionDate: details.collectionDate ? new Date(details.collectionDate).toISOString().slice(0, 16) : '',
                collectionLocation: details.collectionLocation,
                idUserBanks: details.idUserBanks
            });
        }
    }, [details])

    useEffect(() => {
        if (details.idUsers) {
            fetchUserBanks();
        }
    }, [details.idUsers])

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

    const fetchUserBanks = async () => {
        try {
            const res = await fetch('/api/user-bank/' + details.idUsers, getRequestOptions());
            const data = await res.json();
            if (res.status === 200) {
                setUserBanks(data.data);
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

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0] || null;
        setProofOfPaymentFile(file);
    }

    const handleFileUpload = async (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        e.preventDefault();
        if (!proofOfPaymentFile) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Please select a file to upload!',
            });
            return;
        }

        Swal.fire({
            title: 'Are you sure?',
            text: 'Do you want to upload this proof of payment?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Yes',
            cancelButtonText: 'No',
            showLoaderOnConfirm: true,
            allowOutsideClick: false,
            preConfirm: async () => {
                const formData = new FormData();
                formData.append('proofOfPayment', proofOfPaymentFile);
                formData.append('bookingId', router.query.id as string);

                try {
                    const response = await fetch(API_URL + 'api/bookings/proof-of-payment-upload/upload', {
                        method: 'POST',
                        headers: { 'Authorization': 'Bearer ' + getCookie('saathi-token') },
                        body: formData,
                    });

                    if (response.ok) {
                        Swal.fire({
                            icon: 'success',
                            title: 'Success',
                            text: 'File uploaded successfully!',
                        });
                        setReload(true);
                        if (proofOfPaymentRef.current) {
                            proofOfPaymentRef.current.value = '';
                        }
                    } else {
                        const errorResult = await response.json();
                        throw new Error(errorResult.message || 'File upload failed.');
                    }
                } catch (error) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: (error as Error).message,
                    });
                }
            },
        });
    };


    const handleDeny = async (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        e.preventDefault();

        Swal.fire({
            title: 'Are you sure?',
            text: 'You want to deny this booking!',
            icon: 'warning',
            input: 'text',
            inputPlaceholder: 'Enter your remarks here...',
            showCancelButton: true,
            cancelButtonText: 'No',
            confirmButtonText: 'Yes',
            showLoaderOnConfirm: true,
            allowOutsideClick: false,
            allowEscapeKey: false,
            preConfirm: async (remarks) => {
                const formData = {
                    bookingId: details.bookingId,
                    paymentConfirmationStatus: 'denied',
                    remarks: remarks || ''
                };

                try {
                    const res = await fetch(API_URL + 'api/bookings/deny', putRequestOptions(formData));

                    if (res.ok) {
                        Swal.fire({
                            icon: 'success',
                            title: 'Success',
                            text: 'Booking denied successfully!',
                        });
                        setReload(true);
                    } else {
                        const errorResult = await res.json();
                        throw new Error(errorResult.message);
                    }
                } catch (error) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: (error as Error).message || 'Something went wrong!',
                    });
                }
            },
        });
    };


    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        Swal.fire({
            title: 'Are you sure?',
            text: 'Do you want to confirm this booking?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Yes',
            cancelButtonText: 'No',
            showLoaderOnConfirm: true,
            allowOutsideClick: false,
            preConfirm: async () => {
                try {
                    formData.bookingId = details.bookingId;
                    const res = await fetch(API_URL + 'api/bookings/confirm', putRequestOptions(formData));

                    if (res.ok) {
                        Swal.fire({
                            icon: 'success',
                            title: 'Success',
                            text: 'Booking confirmed successfully!',
                        });
                        setReload(true);
                        setApproverModalShow(false);
                    } else {
                        const errorResult = await res.json();
                        throw new Error(errorResult.message);
                    }
                } catch (error) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: (error as Error).message || 'Something went wrong!',
                    });
                }
            },
        });
    };


    const handleInvestmentStatusChange = async (idProjectInvestors: number, investmentStatus: string) => {
        Swal.fire({
            title: 'Are you sure?',
            text: 'You want to change the status of this investment!',
            icon: 'warning',
            showCancelButton: true,
            cancelButtonText: 'No',
            confirmButtonText: 'Yes',
            showLoaderOnConfirm: true,
            allowOutsideClick: false,
            preConfirm: async () => {
                const formData = {
                    idProjectInvestors,
                    investmentStatus,
                };

                try {
                    const res = await fetch(API_URL + 'api/bookings/investment_status_change', putRequestOptions(formData));

                    if (res.ok) {
                        Swal.fire({
                            icon: 'success',
                            title: 'Success',
                            text: 'Investment status changed successfully!',
                        });
                        setReload(true);
                    } else {
                        const errorResult = await res.json();
                        throw new Error(errorResult.message);
                    }
                } catch (error) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: (error as Error).message || 'Something went wrong!',
                    });
                }
            },
        });
    };


    const handleCollectionStatusChange = async (idProjectInvestmentBookings: number, status: string) => {
        Swal.fire({
            title: 'Are you sure?',
            text: "You want to change collection status!",
            icon: 'warning',
            showCancelButton: true,
            cancelButtonText: 'No',
            confirmButtonText: 'Yes'
        }).then((result) => {
            if (result.value) {
                try {
                    const fetchData = async () => {
                        const formData = {
                            idProjectInvestmentBookings,
                            status
                        }
                        const res = await fetch(API_URL + 'api/bookings/collection_status_change', putRequestOptions(formData));
                        if (res.status === 200) {
                            Swal.fire({
                                icon: 'success',
                                title: 'Success',
                                text: 'Collection status changed successfully!',
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

    const handleCancel = async (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        e.preventDefault();
        Swal.fire({
            title: 'Are you sure?',
            text: 'You want to cancel this booking!',
            icon: 'warning',
            input: 'text',
            inputPlaceholder: 'Enter your remarks here...',
            showCancelButton: true,
            cancelButtonText: 'No',
            confirmButtonText: 'Yes',
            showLoaderOnConfirm: true,
            allowOutsideClick: false,
            allowEscapeKey: false,
            preConfirm: async (remarks) => {
                try {
                    const formData = {
                        idProjectInvestmentBookings: details.idProjectInvestmentBookings,
                        remarks: remarks || ''
                    };
                    const res = await fetch(API_URL + 'api/bookings/cancel', putRequestOptions(formData));
                    if (res.status === 200) {
                        Swal.fire({
                            icon: 'success',
                            title: 'Success',
                            text: 'Booking cancelled successfully!',
                        });
                        setReload(true);
                    } else {
                        const result = await res.json();
                        throw new Error(result.message);
                    }
                } catch (err) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: (err as Error).message || 'Something went wrong!',
                    });
                }
            }
        });
    };

    const TimelineItem: React.FC<TimelineItemProps> = ({ icon, color, header, description }) => (
        <div className="timeline-item">
            <div style={{ color }} className="main-icon">
                {icon}
            </div>
            <div className="timeline-card">
                <div className="circle-custom">
                    <i className="fa fas fa-circle"></i>
                </div>
                <div className="subcard">
                    <h3>{header}</h3>
                    <p>{description}</p>
                </div>
            </div>
        </div>
    );

    const paymentMethods = [
        { value: 'cheque', label: 'Cheque' },
        { value: 'beftn', label: 'BEFTN' },
        { value: 'rtgs', label: 'RTGS' },
        { value: 'npsb', label: 'NPSB' },
        { value: 'cash', label: 'Cash' }
    ];

    return (
        <Container>
            <h4 className="text-start"> Booking Details</h4>
            <hr />
            <Tabs defaultActiveKey="details" id="uncontrolled-tab-example" className="mb-3">
                <Tab eventKey="details" title="Details">
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
                                        <td>Cancelled</td>
                                        <td>
                                            <span className={`badge ${details.cancelled === 'yes' ? 'bg-danger' : 'bg-success'}`}>
                                                {details.cancelled === 'yes' ? 'Yes' : 'No'}
                                            </span>
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
                                    {details.cancelled === 'no' && details.paymentConfirmationStatus !== 'confirmed' &&
                                        <tr>
                                            <td>Upload Proof of Payment</td>
                                            <td>
                                                <Form.Group className="mb-3">
                                                    <Form.Control type="file" onChange={handleFileChange} ref={proofOfPaymentRef} />
                                                    <div className="d-flex justify-content-center">
                                                        <Button className='btn btn-primary btn-sm text-light w-50 mt-2' onClick={handleFileUpload}>
                                                            Upload
                                                        </Button>
                                                    </div>
                                                </Form.Group>
                                            </td>
                                        </tr>
                                    }

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
                                                <a href={`${S3_URL}proof-of-payment/${details.proofOfPayment}`} target="_blank" rel="noopener noreferrer">
                                                    <Image
                                                        src={`${S3_URL}proof-of-payment/${details.proofOfPayment}`}
                                                        alt={details.proofOfPayment}
                                                        width={100}
                                                        height={100}
                                                        layout="fixed"
                                                    />
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
                                            {details.paymentAmount}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>Transaction ID</td>
                                        <td>
                                            {details.transactionId}
                                        </td>
                                    </tr>
                                    {(details.paymentMethod === 'cheque' || details.paymentMethod === 'cash') &&
                                        <>
                                            <tr>
                                                <td>Collection Required</td>
                                                <td>
                                                    {details.collectionRequired?.charAt(0).toUpperCase() + details.collectionRequired?.slice(1)}
                                                </td>
                                            </tr>
                                            <tr>
                                                <td>Collection Date</td>
                                                <td>
                                                    {new Date(details.collectionDate).toLocaleString('en-US', { timeZone: 'UTC' })}
                                                </td>
                                            </tr>
                                            <tr>
                                                <td>Collection Location</td>
                                                <td>
                                                    {details.collectionLocation}
                                                </td>
                                            </tr>
                                            <tr>
                                                <td>Collection Status</td>
                                                <td>
                                                    {details.collectionStatus === 'pending' ?
                                                        <DropdownButton
                                                            as={ButtonGroup}
                                                            title="Status"
                                                            id="bg-vertical-dropdown-3"
                                                        >
                                                            <Dropdown.Item eventKey="1" onClick={() => handleCollectionStatusChange(details.idProjectInvestmentBookings, 'collected')}>Collected</Dropdown.Item>
                                                            <Dropdown.Item eventKey="2" onClick={() => handleCollectionStatusChange(details.idProjectInvestmentBookings, 'failed')}>Failed</Dropdown.Item>

                                                        </DropdownButton>
                                                        : details.collectionStatus?.charAt(0).toUpperCase() + details.collectionStatus?.slice(1)
                                                    }
                                                </td>
                                            </tr>
                                        </>
                                    }
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
                                                {project.ProjectPartnerInvestors[0]?.amountInvested}
                                            </td>
                                            <td>
                                                {project.ProjectPartnerInvestors.reduce((acc, curr) => Number(acc) + Number(curr.amountInvested), 0)}
                                            </td>
                                            <td>{project.investmentStatus?.replace(/_/g, ' ').charAt(0).toUpperCase() + project.investmentStatus?.replace(/_/g, ' ').slice(1)}</td>
                                            <td>
                                                {details.cancelled === 'no' && details.paymentConfirmationStatus === 'confirmed' && project.investmentStatus !== 'ready_for_withdrawal' &&
                                                    <Button className='btn btn-sm btn-primary' onClick={() => handleInvestmentStatusChange(project.idProjectInvestors, 'ready_for_withdrawal')}>
                                                        Ready For Withdrawal
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
                    <Row className='justify-content-center'>
                        <Col md={6} className="d-flex justify-content-between">
                            {(details.cancelled === 'no' && details.paymentConfirmationStatus !== 'confirmed') &&
                                <Button className='w-75 me-2' variant="danger" type="button" onClick={handleCancel}>
                                    Cancel
                                </Button>
                            }
                            {details.cancelled === 'no' && details.paymentConfirmationStatus === 'uploaded' &&
                                <>
                                    <Button className='w-75 me-2' variant="primary" type="button" onClick={() => setApproverModalShow(true)}>
                                        Confirm
                                    </Button>
                                    <Button className='w-75' variant="warning" type="button" onClick={handleDeny}>
                                        Deny
                                    </Button>
                                </>
                            }
                        </Col>
                    </Row>
                </Tab>
                <Tab eventKey="timeline" title="Timeline">
                    <div className="timeline">
                        <TimelineItem
                            icon={<ChatDots size={32} />}
                            color="#1395D3"
                            header="2012"
                            description="Bridge inspection prompted discussions about replacement or rehabilitation/retrofit strategies."
                        />
                        <TimelineItem
                            icon={<List size={32} />}
                            color="#F26723"
                            header="2013 - 2016"
                            description="Pierce County developed replacement, rehabilitation, and retrofit options."
                        />
                        <TimelineItem
                            icon={<GraphUp size={32} />}
                            color="#A5B038"
                            header="2017 - 2021"
                            description="Pierce County pursued preliminary funding and identified and evaluated potential funding sources and financial scenarios."
                        />
                        <TimelineItem
                            icon={<FileEarmarkText size={32} />}
                            color="#1395D3"
                            header="2022"
                            description="Pierce County budgeted for a Type, Size, and Location Study for a bridge replacement."
                        />
                        <TimelineItem
                            icon={<HandThumbsUp size={32} />}
                            color="#F26723"
                            header="2023"
                            description="Pierce County advertised for and selected a designer to perform the Type, Size, and Location Study."
                        />
                        <TimelineItem
                            icon={<House size={32} />}
                            color="#F1A01F"
                            header="2024 (Early)"
                            description="Type, Size, and Locations Study kicked off."
                        />
                        <TimelineItem
                            icon={<Calendar size={32} />}
                            color="#A5B038"
                            header="2025 (Late)"
                            description="Type, Size, and Location Study anticipated completion."
                        />
                        <TimelineItem
                            icon={<Rulers size={32} />}
                            color="#1395D3"
                            header="2026 - Beyond"
                            description="Finalize design, complete environmental permitting (NEPA), secure funding. Complete property rights, assessments, and acquisitions. Construction."
                        />
                    </div>
                </Tab>
            </Tabs>

            <Modal show={approverModalShow} onHide={() => setApproverModalShow(false)} size='lg'>
                <Modal.Header closeButton>
                    <Modal.Title>Confirm Booking</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form onSubmit={handleSubmit}>
                        <Form.Group as={Row} className='mb-3'>
                            <Form.Label column sm='4'>Payment Method <span className='text-danger'>*</span></Form.Label>
                            <Col sm='8'>
                                <Select
                                    id="paymentMethod"
                                    instanceId="paymentMethod"
                                    options={paymentMethods.map(method => ({
                                        value: method.value,
                                        label: method.label
                                    }))}
                                    value={paymentMethods.find(method => method.value === formData.paymentMethod.value) ? {
                                        value: formData.paymentMethod.value,
                                        label: formData.paymentMethod.label
                                    } : null}
                                    onChange={(selectedOption: any) => setFormData({ ...formData, paymentMethod: selectedOption })}
                                />
                            </Col>
                        </Form.Group>
                        {(formData.paymentMethod.value === 'cheque' || formData.paymentMethod.value === 'cash') &&
                            <>
                                <Form.Group as={Row} className='mb-3'>
                                    <Form.Label column sm='4'>Collection Date <span className='text-danger'>*</span></Form.Label>
                                    <Col sm='8'>
                                        <Form.Control type='datetime-local' name='collectionDate' value={formData.collectionDate} onChange={handleOnChange} />
                                    </Col>
                                </Form.Group>

                                <Form.Group as={Row} className='mb-3'>
                                    <Form.Label column sm='4'>Collection Location <span className='text-danger'>*</span></Form.Label>
                                    <Col sm='8'>
                                        <Form.Control type='text' name='collectionLocation' value={formData.collectionLocation} onChange={handleOnChange} />
                                    </Col>
                                </Form.Group>
                            </>
                        }
                        {formData.paymentMethod.value !== 'cash' && formData.paymentMethod.value !== 'cheque' &&
                            <Form.Group as={Row} className='mb-3'>
                                <Form.Label column sm='4'>User Bank <span className='text-danger'>*</span></Form.Label>
                                <Col sm='8'>
                                    <Select
                                        id="idUserBanks"
                                        instanceId="idUserBanks"
                                        options={userBanks.map(bank => ({
                                            value: bank.idUserBanks,
                                            label: `${bank.Bank.bankNameFull} - ${bank.BankBranch.branchName} - ${bank.accountNumber}`
                                        }))}
                                        value={userBanks.find(bank => bank.idUserBanks === formData.idUserBanks) ? {
                                            value: formData.idUserBanks,
                                            label: userBanks.find(bank => bank.idUserBanks === formData.idUserBanks)?.Bank.bankNameFull + ' - ' + userBanks.find(bank => bank.idUserBanks === formData.idUserBanks)?.BankBranch.branchName + ' - ' + userBanks.find(bank => bank.idUserBanks === formData.idUserBanks)?.accountNumber
                                        } : null}
                                        onChange={(selectedOption: any) => setFormData({ ...formData, idUserBanks: selectedOption.value })}
                                    />
                                </Col>
                            </Form.Group>
                        }
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
                    {/* <pre>{JSON.stringify(formData, null, 2)}</pre> */}
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
