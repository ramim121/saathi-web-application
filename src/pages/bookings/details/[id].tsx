/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef, use } from 'react';
import { useRouter } from "next/router";
import MainLayout from "@/layouts/MainLayout";
import { Container, Row, Col, Table, Button, Modal, Form, DropdownButton, Dropdown, ButtonGroup, Tabs, Tab } from "react-bootstrap";
import { getRequestOptions, putRequestOptions } from "@/utils/Fetch";
import Swal from "sweetalert2";
import { S3_URL } from '@/config/constants';
import Image from "next/image";
import { API_URL } from '@/config/constants';
import Select, { components } from "react-select";
import { getCookie } from '@/utils/GetCookie';
import { ChatDots } from 'react-bootstrap-icons';
import Link from 'next/link';

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
            idProjects: number;
            projectName: string;
            duration: number;
            tenure: string;
            returnRangeMin: number;
            returnRangeMax: number;
        };
        unitPurchased: number;
        investmentDate: string;
        investmentStatus: string;
        projectStartDate: string;
        maturityDate: string;
        ProjectPartnerInvestors: {
            ProjectPartner: {
                User: {
                    idUsers: number;
                    fullName: string;
                };
                partnerUnitCapacity: number;
                remainingCapacity: number;
            };
            amountInvested: number;
            idProjectPartnerInvestors: number;
            investedUnit: number;

        }[];
        idProjectInvestors: number;
        ProjectSpecialBookingReq?: {
            additionalRequest: string;
            deliveryLocation: string;
            preferredColor: string;
            preferredProductPrice: number;
        }
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

interface HistoryProps {
    idProjectInvestmentBookingStatus?: number;
    idProjectInvestmentBookings?: number;
    idProjectInvestorStatus?: number;
    idProjectInvestors?: number;
    User: {
        fullName: string;
    }
    status: string;
    remarks: string;
    createdAtFormatted: string;
}

interface LiveUpdateFormDataProps {
    idProjectPartnerInvestors: string;
    liveWeight: number | null;
    updateDate: string;
    updateBody: string;
    updateTitle: string;
    videoUrl: string;
    updateImage: File | null;
}

interface LiveUpdateListDataProps {
    idProjectPartnerInvestorUpdates: number;
    idProjectPartnerInvestors: number;
    createdAt: string;
    liveWeight: number | null;
    updateDate: string;
    updateBody: string;
    updateTitle: string;
    videoUrl: string;
    updateImage: string;
    imageThumbnail: string;
}

interface ProjectPartnersProps {
    label: string;
    value: number;
    idProjectPartners: number;
    partnerUnitCapacity: number;
    alreadyInvestedUnits: number;
    User: {
        fullName: string;
        phoneNumber: string;
        ProfilePicture: {
            fileName: string;
        };
    };
    investorConfirmedBookingCount: number;
    investorAlreadyBookedCount: number;
}

interface ChangePartnerFormDataProps {
    idProjects: number;
    idProjectPartnerInvestors: number;
    idProjectPartners: number;
}

const CustomOptionPartner = ({ data, ...props }: { data: ProjectPartnersProps, [key: string]: any }) => (
    // @ts-expect-error This error is expected because the props are spread into the component, and the type of props is not explicitly defined.
    <components.Option {...props}>
        Name: {data.label}
        <br />
        Mobile: {data.User.phoneNumber}
        <br />
        Unit Capacity: {data.partnerUnitCapacity}
        <br />
        Confirmed Booking: {data.investorConfirmedBookingCount}
        <br />
        Already Booked: {data.investorAlreadyBookedCount}
        <br />
        Remaining Capacity: {data.partnerUnitCapacity - data.investorConfirmedBookingCount}
    </components.Option>
);

function formatDate(dateStr?: string): string {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    const day = date.getDate();
    const month = date.toLocaleString("en-GB", { month: "short" });
    const year = date.getFullYear();
    const j = day % 10, k = day % 100;
    let suffix = "th";
    if (j === 1 && k !== 11) suffix = "st";
    else if (j === 2 && k !== 12) suffix = "nd";
    else if (j === 3 && k !== 13) suffix = "rd";
    return `${day}${suffix} ${month} ${year}`;
}

function Details() {
    const router = useRouter();
    const { id } = router.query;
    const [details, setDetails] = useState<DetailsProps>({} as DetailsProps);
    const [history, setHistory] = useState<HistoryProps[]>([]);
    const [reload, setReload] = useState<boolean>(false);
    const [approverModalShow, setApproverModalShow] = useState<boolean>(false);
    const [liveUpdateModalShow, setLiveUpdateModalShow] = useState<boolean>(false);
    const [liveUpdateListModalShow, setLiveUpdateListModalShow] = useState<boolean>(false);
    const [partnerChangeModalShow, setPartnerChangeModalShow] = useState<boolean>(false);
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
    const [liveUpdateFormData, setLiveUpdateFormData] = useState<LiveUpdateFormDataProps>({
        idProjectPartnerInvestors: '',
        liveWeight: null,
        updateDate: '',
        updateBody: '',
        updateTitle: '',
        videoUrl: '',
        updateImage: null,
    });
    const [userBanks, setUserBanks] = useState<UserBanksProps[]>([]);
    const [liveUpdateListData, setLiveUpdateListData] = useState<LiveUpdateListDataProps[]>([]);
    const [changePartnerFormData, setChangePartnerFormData] = useState<ChangePartnerFormDataProps>({
        idProjects: 0,
        idProjectPartnerInvestors: 0,
        idProjectPartners: 0
    });
    const [projectPartners, setProjectPartners] = useState<ProjectPartnersProps[]>([]);
    const proofOfPaymentRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (id != undefined) {
            fetchBookingDetails();
        }
    }, [id])

    useEffect(() => {
        if (reload === true) {
            fetchBookingDetails();
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

    useEffect(() => {
        if (changePartnerFormData.idProjects !== 0) {
            fetchProjectPartners();
        }
    }, [changePartnerFormData.idProjects])

    const fetchLiveUpdateList = async (idProjectPartnerInvestors: string) => {
        try {
            const res = await fetch('/api/live-update/list/' + idProjectPartnerInvestors, getRequestOptions());
            const data = await res.json();
            if (res.status === 200) {
                setLiveUpdateListData(data.data);
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

    const fetchBookingDetails = async () => {
        try {
            const res = await fetch('/api/bookings/details/' + id, getRequestOptions());
            const data = await res.json();
            if (res.status === 200) {
                setDetails(data.data);
                setHistory(data.history);
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

    const fetchProjectPartners = async () => {
        try {
            const res = await fetch('/api/projects/project-partners/' + changePartnerFormData.idProjects, getRequestOptions());
            const data = await res.json();
            if (res.status === 200) {
                const newItems = data.data.map(function (element: { User: { fullName: string }, idProjectPartners: number }) {
                    return { ...element, label: element.User.fullName, value: element.idProjectPartners }
                });
                setProjectPartners(newItems);
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
                        Swal.fire({
                            icon: 'error',
                            title: 'Error',
                            html: (await response.json()).message,
                        });
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
                        Swal.fire({
                            icon: 'error',
                            title: 'Error',
                            html: (await res.json()).message,
                        });
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
                        Swal.fire({
                            icon: 'error',
                            title: 'Error',
                            html: (await res.json()).message,
                        });
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
                        Swal.fire({
                            icon: 'error',
                            title: 'Error',
                            html: (await res.json()).message,
                        });
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
                        Swal.fire({
                            icon: 'error',
                            title: 'Error',
                            html: (await res.json()).message,
                        });
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

    const handleLiveUpdateSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        Swal.fire({
            title: 'Are you sure?',
            text: 'Do you want to submit this live update?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Yes',
            cancelButtonText: 'No',
            showLoaderOnConfirm: true,
            allowOutsideClick: false,
            preConfirm: async () => {
                try {
                    const formData = new FormData();
                    formData.append('idProjectPartnerInvestors', liveUpdateFormData.idProjectPartnerInvestors);
                    formData.append('liveWeight', liveUpdateFormData.liveWeight?.toString() || '');
                    formData.append('updateDate', liveUpdateFormData.updateDate);
                    formData.append('updateTitle', liveUpdateFormData.updateTitle);
                    formData.append('updateBody', liveUpdateFormData.updateBody);
                    formData.append('videoUrl', liveUpdateFormData.videoUrl);
                    if (liveUpdateFormData.updateImage) {
                        formData.append('updateImage', liveUpdateFormData.updateImage);
                    }

                    const res = await fetch(API_URL + 'api/live-update/create', {
                        method: 'POST',
                        headers: { 'Authorization': 'Bearer ' + getCookie('saathi-token') },
                        body: formData,
                    });

                    if (res.ok) {
                        Swal.fire({
                            icon: 'success',
                            title: 'Success',
                            text: 'Live update submitted successfully!',
                        });
                        setLiveUpdateFormData({
                            idProjectPartnerInvestors: '',
                            liveWeight: null,
                            updateDate: '',
                            updateBody: '',
                            updateTitle: '',
                            videoUrl: '',
                            updateImage: null,
                        });
                        setReload(true);
                        setLiveUpdateModalShow(false);
                    } else {
                        Swal.fire({
                            icon: 'error',
                            title: 'Error',
                            html: (await res.json()).message,
                        });
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

    const handleChangePartner = async (idProjects: number, idProjectPartnerInvestors: number) => {
        setChangePartnerFormData({
            idProjects,
            idProjectPartnerInvestors,
            idProjectPartners: 0
        });
        setPartnerChangeModalShow(true);
    }

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
                                        <td>Payment Status</td>
                                        <td>
                                            <span className={`badge ${details.paymentConfirmationStatus === 'confirmed' ? 'bg-success' : details.paymentConfirmationStatus === 'denied' ? 'bg-danger' : 'bg-warning'}`}>
                                                {details.paymentConfirmationStatus?.charAt(0).toUpperCase() + details.paymentConfirmationStatus?.slice(1)}
                                            </span>
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
                                        <th>Project Partners / Updates</th>
                                        <th>Range</th>
                                        <th>Unit Price</th>
                                        <th>Invested Amount</th>
                                        <th>Return</th>
                                        <th>Start Date</th>
                                        <th>Maturity Date</th>
                                        <th>Remaining</th>
                                        <th>Investment Status</th>
                                        <th>Special Booking Req</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {details.ProjectInvestors && details.ProjectInvestors.map((project, index) => (
                                        <tr key={index}>
                                            <td>{index + 1}</td>
                                            <td>{project.investmentDate}</td>

                                            <td>
                                                <Link href={`/projects/details/${project.Project.idProjects}`}>
                                                    {project.Project.projectName}
                                                </Link>
                                            </td>

                                            <td>{project.unitPurchased}</td>
                                            <td className="p-0 m-0">
                                                <Table className="m-0 table-borderless">
                                                    <tbody>
                                                        {
                                                            project.ProjectPartnerInvestors.map((partner, index) => {
                                                                return (
                                                                    <tr key={index}>
                                                                        <td className="text-start" style={{ whiteSpace: 'nowrap' }}>
                                                                            <Link href={`/partners/details/${partner.ProjectPartner.User.idUsers}`}>
                                                                                {partner.ProjectPartner.User.fullName}
                                                                            </Link>
                                                                        </td>
                                                                        {details.cancelled === 'no' && details.paymentConfirmationStatus !== 'confirmed' && partner.investedUnit > partner.ProjectPartner.remainingCapacity &&
                                                                            <td>
                                                                                <Button className='btn btn-sm btn-warning' style={{ whiteSpace: 'nowrap' }} onClick={() => handleChangePartner(project.Project.idProjects, partner.idProjectPartnerInvestors)}>
                                                                                    Change Partner
                                                                                </Button>
                                                                            </td>
                                                                        }
                                                                        {details.cancelled === 'no' &&
                                                                            <td className="text-end">
                                                                                <Button className='btn btn-sm btn-primary' onClick={() => {
                                                                                    Swal.fire({
                                                                                        title: 'Live Updates',
                                                                                        showCancelButton: false,
                                                                                        showDenyButton: true,
                                                                                        confirmButtonText: 'Create',
                                                                                        denyButtonText: 'List',
                                                                                        denyButtonColor: '#0dcaf0',
                                                                                        preConfirm: () => {
                                                                                            setLiveUpdateModalShow(true);
                                                                                            setLiveUpdateFormData({ ...liveUpdateFormData, idProjectPartnerInvestors: partner.idProjectPartnerInvestors.toString() });
                                                                                        },
                                                                                        preDeny: () => {
                                                                                            fetchLiveUpdateList(partner.idProjectPartnerInvestors.toString());
                                                                                            setLiveUpdateListModalShow(true);
                                                                                        }
                                                                                    });
                                                                                }} style={{ whiteSpace: 'nowrap' }}>
                                                                                    Live Updates
                                                                                </Button>
                                                                            </td>
                                                                        }
                                                                    </tr>
                                                                )
                                                            })
                                                        }
                                                    </tbody>
                                                </Table>
                                            </td>
                                            <td>
                                                {project.Project.duration} {project.Project.tenure?.charAt(0).toUpperCase() + project.Project.tenure?.slice(1) + '(' + project.Project.returnRangeMin + '% -' + project.Project.returnRangeMax + '%'}
                                            </td>
                                            <td>
                                                {project.ProjectPartnerInvestors[0]?.amountInvested}
                                            </td>
                                            <td>
                                                {project.ProjectPartnerInvestors.reduce((acc, curr) => Number(acc) + Number(curr.amountInvested), 0)}
                                            </td>
                                            <td>
                                                {(() => {
                                                    const totalInvested = project.ProjectPartnerInvestors.reduce((acc, curr) => Number(acc) + Number(curr.amountInvested), 0);
                                                    const minReturn = totalInvested + (totalInvested * project.Project.returnRangeMin / 100);
                                                    const maxReturn = totalInvested + (totalInvested * project.Project.returnRangeMax / 100);
                                                    return `${minReturn.toLocaleString()} - ${maxReturn.toLocaleString()}`;
                                                })()}
                                            </td>
                                            <td>
                                                {formatDate(project.projectStartDate)}
                                            </td>
                                            <td>
                                                {formatDate(project.maturityDate)}
                                            </td>
                                            <td>
                                                {(() => {
                                                    if (!project.maturityDate) return "-";
                                                    const maturity = new Date(project.maturityDate);
                                                    const now = new Date();
                                                    const diff = maturity.getTime() - now.getTime();
                                                    if (isNaN(diff)) return "-";
                                                    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
                                                    return days > 0 ? `${days} days` : "Matured";
                                                })()}
                                            </td>
                                            <td>{project.investmentStatus?.replace(/_/g, ' ').charAt(0).toUpperCase() + project.investmentStatus?.replace(/_/g, ' ').slice(1)}</td>
                                            <td>
                                                {project.ProjectSpecialBookingReq &&
                                                    <>
                                                        <strong>Additional Request:</strong> {project.ProjectSpecialBookingReq.additionalRequest}<br />
                                                        <strong>Delivery Location:</strong> {project.ProjectSpecialBookingReq.deliveryLocation}<br />
                                                        <strong>Preferred Color:</strong> {project.ProjectSpecialBookingReq.preferredColor}<br />
                                                        <strong>Preferred Price:</strong> {project.ProjectSpecialBookingReq.preferredProductPrice}<br />
                                                    </>
                                                }
                                            </td>
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
                                        <td colSpan={7} style={{ textAlign: 'right' }}>
                                            <strong> Total Payable Amount:</strong>
                                        </td>
                                        <td>
                                            {details.ProjectInvestors && details.ProjectInvestors.reduce((acc, curr) => Number(acc) + curr.ProjectPartnerInvestors.reduce((acc, curr) => Number(acc) + Number(curr.amountInvested), 0), 0)}
                                        </td>
                                        <td colSpan={7}></td>
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
                        {history.map((item, index) => (
                            <TimelineItem
                                key={index}
                                icon={<ChatDots size={32} />}
                                color="#1395D3"
                                header={item.status.charAt(0).toUpperCase() + item.status.slice(1).replace(/_/g, ' ')}
                                description={item.User.fullName + ' - ' + item.remarks + ' - ' + item.createdAtFormatted}
                            />
                        ))}
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

            <Modal show={liveUpdateModalShow} onHide={() => setLiveUpdateModalShow(false)} size='lg'>
                <Modal.Header closeButton>
                    <Modal.Title>Live Update</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form onSubmit={handleLiveUpdateSubmit}>
                        <Form.Group as={Row} className='mb-3'>
                            <Form.Label column sm='4'>Live Weight</Form.Label>
                            <Col sm='8'>
                                <Form.Control type='number' name='liveWeight' value={liveUpdateFormData.liveWeight ?? ''} onChange={(e) => setLiveUpdateFormData({ ...liveUpdateFormData, liveWeight: Number(e.target.value) })} />
                            </Col>
                        </Form.Group>
                        <Form.Group as={Row} className='mb-3'>
                            <Form.Label column sm='4'>Update Date <span className='text-danger'>*</span></Form.Label>
                            <Col sm='8'>
                                <Form.Control type='date' name='updateDate' value={liveUpdateFormData.updateDate} onChange={(e) => setLiveUpdateFormData({ ...liveUpdateFormData, updateDate: e.target.value })} />
                            </Col>
                        </Form.Group>
                        <Form.Group as={Row} className='mb-3'>
                            <Form.Label column sm='4'>Update Title <span className='text-danger'>*</span></Form.Label>
                            <Col sm='8'>
                                <Form.Control type='text' name='updateTitle' value={liveUpdateFormData.updateTitle} onChange={(e) => setLiveUpdateFormData({ ...liveUpdateFormData, updateTitle: e.target.value })} />
                            </Col>
                        </Form.Group>
                        <Form.Group as={Row} className='mb-3'>
                            <Form.Label column sm='4'>Update Body <span className='text-danger'>*</span></Form.Label>
                            <Col sm='8'>
                                <Form.Control as='textarea' name='updateBody' value={liveUpdateFormData.updateBody} onChange={(e) => setLiveUpdateFormData({ ...liveUpdateFormData, updateBody: e.target.value })} />
                            </Col>
                        </Form.Group>
                        <Form.Group as={Row} className='mb-3'>
                            <Form.Label column sm='4'>Video URL</Form.Label>
                            <Col sm='8'>
                                <Form.Control type='text' name='videoUrl' value={liveUpdateFormData.videoUrl} onChange={(e) => setLiveUpdateFormData({ ...liveUpdateFormData, videoUrl: e.target.value })} />
                            </Col>
                        </Form.Group>
                        <Form.Group as={Row} className='mb-3'>
                            <Form.Label column sm='4'>Update Image</Form.Label>
                            <Col sm='8'>
                                <Form.Control type='file' name='updateImage' onChange={
                                    (e: React.ChangeEvent<HTMLInputElement>) => {
                                        const file = e.target.files?.[0] || null;
                                        setLiveUpdateFormData({
                                            ...liveUpdateFormData,
                                            updateImage: file
                                        });
                                    }
                                } />
                            </Col>
                        </Form.Group>
                        <Row className='justify-content-center'>
                            <Button className='w-50 mt-2' variant="primary" type="submit" >
                                Submit
                            </Button>
                        </Row>
                    </Form>
                    {/* <pre>{JSON.stringify(liveUpdateFormData, null, 2)}</pre> */}
                </Modal.Body>
            </Modal>
            <Modal show={liveUpdateListModalShow} onHide={() => setLiveUpdateListModalShow(false)} size='lg'>
                <Modal.Header closeButton>
                    <Modal.Title>Live Update List</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Table bordered size='sm'>
                        <thead>
                            <tr>
                                <th>Sl</th>
                                <th>Live Weight</th>
                                <th>Update Date</th>
                                <th>Update Title</th>
                                <th>Update Body</th>
                                <th>Video URL</th>
                                <th>Update Image</th>
                            </tr>
                        </thead>
                        <tbody>
                            {liveUpdateListData.length > 0 ? (
                                liveUpdateListData.map((liveUpdate, index) => (
                                    <tr key={index}>
                                        <td>{index + 1}</td>
                                        <td>{liveUpdate.liveWeight}</td>
                                        <td>{liveUpdate.updateDate}</td>
                                        <td>{liveUpdate.updateTitle}</td>
                                        <td>{liveUpdate.updateBody}</td>
                                        <td>
                                            {liveUpdate.videoUrl !== null && (
                                                <a href={liveUpdate.videoUrl.startsWith('http') ? liveUpdate.videoUrl : `http://${liveUpdate.videoUrl}`} target="_blank" rel="noopener noreferrer">
                                                    {liveUpdate.videoUrl}
                                                </a>
                                            )}
                                        </td>
                                        <td>
                                            {liveUpdate.updateImage !== null &&
                                                <a href={`${S3_URL}live-update/${liveUpdate.idProjectPartnerInvestorUpdates}/${liveUpdate.updateImage}`} target="_blank" rel="noopener noreferrer">
                                                    <Image
                                                        src={`${S3_URL}live-update/${liveUpdate.idProjectPartnerInvestorUpdates}/${liveUpdate.imageThumbnail}`}
                                                        alt={liveUpdate.updateImage}
                                                        width={100}
                                                        height={100}
                                                        layout="fixed"
                                                    />
                                                </a>
                                            }
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={7} className="text-center">No live updates found</td>
                                </tr>
                            )}
                        </tbody>
                    </Table>
                </Modal.Body>
            </Modal>

            <Modal show={partnerChangeModalShow} onHide={() => setPartnerChangeModalShow(false)} size='lg'>
                <Modal.Header closeButton>
                    <Modal.Title>Change Partner</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form.Group as={Row} className='mb-3'>
                        <Form.Label column sm='4'>Select Partner <span className='text-danger'>*</span></Form.Label>
                        <Col sm='8'>
                            <Select
                                options={projectPartners}
                                isSearchable
                                isClearable
                                placeholder='Select Partner'
                                onChange={(selectedOption: any) => setChangePartnerFormData({ ...changePartnerFormData, idProjectPartners: selectedOption.value })}
                                value={projectPartners.find(partner => partner.value === changePartnerFormData.idProjectPartners) || null}
                                components={{ Option: CustomOptionPartner }}
                            />
                        </Col>
                    </Form.Group>
                    <Row className='justify-content-center'>
                        <Button className='w-50 mt-2' variant="primary" type="button" onClick={() => {
                            Swal.fire({
                                title: 'Are you sure?',
                                text: 'Do you want to change the partner?',
                                icon: 'warning',
                                showCancelButton: true,
                                confirmButtonText: 'Yes',
                                cancelButtonText: 'No',
                                showLoaderOnConfirm: true,
                                allowOutsideClick: false,
                                preConfirm: async () => {
                                    try {
                                        const res = await fetch(API_URL + 'api/bookings/change-partner', putRequestOptions(changePartnerFormData));

                                        if (res.ok) {
                                            Swal.fire({
                                                icon: 'success',
                                                title: 'Success',
                                                text: 'Partner changed successfully!',
                                            });
                                            setReload(true);
                                            setPartnerChangeModalShow(false);
                                            setChangePartnerFormData({
                                                idProjects: 0,
                                                idProjectPartnerInvestors: 0,
                                                idProjectPartners: 0
                                            });
                                        } else {
                                            Swal.fire({
                                                icon: 'error',
                                                title: 'Error',
                                                html: (await res.json()).message,
                                            });
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
                        }}>
                            Change Partner
                        </Button>
                    </Row>
                    {/* <pre>{JSON.stringify(projectPartners, null, 2)}</pre>
                    <pre>{JSON.stringify(changePartnerFormData, null, 2)}</pre> */}
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
