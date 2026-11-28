/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from "next/router";
import Link from 'next/link';
import MainLayout from "@/layouts/MainLayout";
import { Modal } from "react-bootstrap";
import { getRequestOptions, putRequestOptions } from "@/utils/Fetch";
import Swal from "sweetalert2";
import { S3_URL } from '@/config/public';
import { API_URL } from '@/config/public';
import { getCookie } from '@/utils/GetCookie';
import { isProofSubmitted } from '@/utils/bookingStatus';
import { DHAKA_OFFSET_MS, formatDue, timeLeft } from '@/utils/bookingHoldsShared';
import {
    ArrowLeft,
    ArrowUpRight,
    Ban,
    BellRing,
    CalendarClock,
    Check,
    CheckCircle2,
    FileText,
    History as HistoryIcon,
    ImageOff,
    Layers,
    ListChecks,
    PlayCircle,
    Plus,
    Repeat2,
    ShieldAlert,
    TrendingUp,
    Undo2,
    Upload,
    UserRound,
    Wallet,
    XCircle,
    type LucideIcon,
} from 'lucide-react';
import { Avatar, Card, Pill, Segmented, Skeleton, cx, type Tone } from '@/ui/primitives';
import { Button, Field, FileInput, Input, Required, SearchInput, Select, Textarea } from '@/ui/controls';
import { bdt, bdtExact, bdtRange, date, daysFromToday, plural, relativeDays } from '@/ui/format';
import { capitalise, dhakaStamp, investmentStatus, paymentStatus, utcStamp } from '@/ui/status';
import { ReinvestDialog } from '@/components/bookings/ReinvestDialog';
import { InvestorBalance } from '@/components/bookings/InvestorBalance';

interface DetailsProps {
    idProjectInvestmentBookings: number;
    idUsers: number;
    bookingId: string;
    cancelled: string;
    /** `fresh` or `reinvestment`. A reinvestment carries no payment method. */
    bookingType?: string;
    /** Carried over from the matured investment; the rest of paymentAmount is the top-up. */
    reinvestedAmount?: number | string;
    reinvestmentSource?: { idProjectInvestmentBookings: number | null; bookingId: string | null; projectName: string | null } | null;
    createdAt?: string;
    idUserBanks: number;
    User: {
        fullName: string;
        phoneNumber: string;
        nidVerified?: string;
        nidVerificationStatus?: string;
    },
    paymentConfirmationStatus: string;
    /** End of the payment window (UTC), the derived state and why it was cancelled (utils/bookingHolds.ts). */
    paymentDueAt?: string | null;
    state?: string;
    cancelReason?: string | null;
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
    ProjectInvestors: InvestmentLine[];
}

interface InvestmentLine {
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
    actualProfitPercentage: number;
    actualProfitAmount: number;
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
}

/**
 * The investor's NID state, in words an admin can act on.
 *
 * WHY THIS IS ON THE BOOKING PAGE
 * An approved NID used to be required before anyone could book, so every
 * booking that reached this screen came from an approved investor and there
 * was nothing to show. That rule was removed on 2026-11-13. Bookings now
 * arrive from investors whose NID is pending, rejected or was never uploaded,
 * and confirming the payment here is the last point at which a person looks
 * at the booking — so this is where the state has to be visible.
 *
 * `nidVerified` decides "approved", not the status column: approval sets both,
 * and a row reading `approved` while `nidVerified` is still `no` has not been
 * approved.
 */
function investorNidState(user?: { nidVerified?: string; nidVerificationStatus?: string }): { approved: boolean; label: string; tone: Tone } {
    if (user?.nidVerified === 'yes') {
        return { approved: true, label: 'Approved', tone: 'green' };
    }
    if (user?.nidVerificationStatus === 'pending') {
        return { approved: false, label: 'Pending review', tone: 'amber' };
    }
    if (user?.nidVerificationStatus === 'rejected') {
        return { approved: false, label: 'Rejected', tone: 'rose' };
    }
    return { approved: false, label: 'Not submitted', tone: 'slate' };
}

/**
 * Money, units and price per unit on one investment line, from what was
 * recorded: the partner rows.
 *
 * The price is recorded money / units. The old table printed the amount
 * allocated to the FIRST partner as the unit price, which only equals the unit
 * price when that partner holds exactly one unit — a 12-unit booking at 25,000
 * split 4/4/4 showed 100,000. Taken from the booking's own figures rather than
 * the project's current price, so it stays right if the project is repriced.
 * Units come from the partner rows too, so the two always describe the same
 * thing; the line's own unit count is the fallback.
 */
function lineFigures(line: InvestmentLine) {
    const partners = line.ProjectPartnerInvestors ?? [];
    const amount = partners.reduce((sum, p) => sum + Number(p.amountInvested || 0), 0);
    const units = partners.reduce((sum, p) => sum + Number(p.investedUnit || 0), 0) || Number(line.unitPurchased || 0);
    const min = Number(line.Project?.returnRangeMin || 0);
    const max = Number(line.Project?.returnRangeMax || 0);
    return {
        amount,
        // No partner rows means no money recorded: a price of ৳0 would be a guess.
        unitPrice: partners.length && units ? amount / units : null,
        backMin: amount + (amount * min) / 100,
        backMax: amount + (amount * max) / 100,
    };
}

/** A line that has finished one way or another: no more notices or payouts. */
const CLOSED_LINE = ['cancelled', 'withdrawn', 'reinvested_full', 'reinvested_capital', 'reinvested_profit'];

const METHOD_LABEL: Record<string, string> = { cheque: 'Cheque', beftn: 'BEFTN', rtgs: 'RTGS', npsb: 'NPSB', cash: 'Cash' };

function historyTone(status: string | null | undefined): Tone {
    const s = status ?? '';
    if (/confirm|collected/.test(s)) return 'green';
    if (/den|cancel|fail|reject/.test(s)) return 'rose';
    if (/reinvest/.test(s)) return 'violet';
    if (/withdraw|upload|proof/.test(s)) return 'sky';
    if (/pending|book/.test(s)) return 'amber';
    return 'slate';
}

const HISTORY_DOT: Record<Tone, string> = {
    green: 'tw-bg-emerald-500',
    amber: 'tw-bg-amber-500',
    sky: 'tw-bg-sky-500',
    slate: 'tw-bg-slate-400',
    violet: 'tw-bg-violet-500',
    rose: 'tw-bg-rose-500',
};

function remainingLabel(maturity: string | null | undefined): string {
    if (!maturity) return '—';
    const days = daysFromToday(maturity);
    if (days > 0) return `${plural(days, 'day')} left`;
    if (days === 0) return 'Matures today';
    return 'Matured';
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
    createdAt?: string;
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
    confirmedUnits?: number;
    pendingUnits?: number;
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

/* ---------------------------------------------------------------- layout */

function Stat({ icon: Icon, label, value, hint }: { icon: LucideIcon; label: string; value: React.ReactNode; hint?: React.ReactNode }) {
    return (
        <Card className="tw-p-4">
            <div className="tw-flex tw-items-center tw-gap-2 tw-text-xs tw-font-medium tw-text-slate-500">
                <Icon className="tw-h-4 tw-w-4 tw-text-slate-400" aria-hidden />
                {label}
            </div>
            <div className="tw-mt-2 tw-truncate tw-text-xl tw-font-semibold tw-tabular-nums tw-tracking-tight tw-text-slate-900">{value}</div>
            {hint && <div className="tw-mt-0.5 tw-truncate tw-text-xs tw-text-slate-500">{hint}</div>}
        </Card>
    );
}

function Section({ title, icon: Icon, children, className }: { title: string; icon: LucideIcon; children: React.ReactNode; className?: string }) {
    return (
        <Card className={cx('tw-flex tw-flex-col', className)}>
            <h2 className="tw-flex tw-items-center tw-gap-2 tw-border-b tw-border-slate-100 tw-px-5 tw-py-3 tw-text-sm tw-font-semibold tw-text-slate-900">
                <Icon className="tw-h-4 tw-w-4 tw-text-slate-400" aria-hidden />
                {title}
            </h2>
            <div className="tw-flex-1 tw-px-5 tw-py-4">{children}</div>
        </Card>
    );
}

/** One label/value row in a section's description list. */
function Fact({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="tw-flex tw-items-baseline tw-justify-between tw-gap-4 tw-py-1.5">
            <dt className="tw-shrink-0 tw-text-sm tw-text-slate-500">{label}</dt>
            <dd className="tw-min-w-0 tw-break-words tw-text-right tw-text-sm tw-font-medium tw-text-slate-900">{children}</dd>
        </div>
    );
}

const dash = <span className="tw-font-normal tw-text-slate-400">—</span>;

function Details() {
    const router = useRouter();
    const { id } = router.query;
    const [details, setDetails] = useState<DetailsProps>({} as DetailsProps);
    const [history, setHistory] = useState<HistoryProps[]>([]);
    const [reload, setReload] = useState<boolean>(false);
    const [loadFailed, setLoadFailed] = useState<boolean>(false);
    const [tab, setTab] = useState<'overview' | 'activity'>('overview');
    const [approverModalShow, setApproverModalShow] = useState<boolean>(false);
    const [liveUpdateModalShow, setLiveUpdateModalShow] = useState<boolean>(false);
    const [liveUpdateListModalShow, setLiveUpdateListModalShow] = useState<boolean>(false);
    const [liveUpdateListLoading, setLiveUpdateListLoading] = useState<boolean>(false);
    const [partnerChangeModalShow, setPartnerChangeModalShow] = useState<boolean>(false);
    const [partnerQuery, setPartnerQuery] = useState<string>('');
    const [proofPreviewFailed, setProofPreviewFailed] = useState<boolean>(false);
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
    /** The matured line being reinvested (opens the dialog), and a key to refresh the balance. */
    const [reinvestLine, setReinvestLine] = useState<number | null>(null);
    const [balanceKey, setBalanceKey] = useState(0);

    useEffect(() => {
        if (id != undefined) {
            fetchBookingDetails();
        }
    }, [id])

    // Lists link here with ?reinvest=<line> to open the dialog straight away.
    useEffect(() => {
        const wanted = Number(router.query.reinvest);
        if (!wanted || !details.ProjectInvestors?.some((l) => l.idProjectInvestors === wanted)) return;
        setReinvestLine(wanted);
        const { reinvest: _drop, ...rest } = router.query;
        void _drop;
        router.replace({ pathname: router.pathname, query: rest }, undefined, { shallow: true });
    }, [router.query.reinvest, details.ProjectInvestors])

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
                // Nothing recorded yet (the app's upload does not send an
                // amount): start from what the open projects cost, so a
                // multi-project booking is not confirmed for one project only.
                paymentAmount:
                    Number(details.paymentAmount) > 0
                        ? details.paymentAmount
                        : ((details.ProjectInvestors ?? [])
                              .filter((l) => l.investmentStatus !== 'cancelled')
                              .map(lineFigures)
                              .reduce((sum, f) => sum + f.amount, 0) as any),
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
        setLiveUpdateListLoading(true);
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
        } finally {
            setLiveUpdateListLoading(false);
        }
    }

    const fetchBookingDetails = async () => {
        try {
            const res = await fetch('/api/bookings/details/' + id, getRequestOptions());
            const data = await res.json();
            if (res.status === 200) {
                setDetails(data.data);
                setHistory(data.history);
                setLoadFailed(false);
                setProofPreviewFailed(false);
                setReload(false);
            } else {
                setLoadFailed(true);
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: data.message,
                });
            }
        } catch (err: any) {
            setLoadFailed(true);
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
                    let res = await fetch(API_URL + 'api/bookings/confirm', putRequestOptions(formData));
                    let body = await res.json();

                    // A partner filled up after this booking was made: offer to
                    // move the units to partners with room, then confirm.
                    if (res.status === 409 && body.code === 'PARTNER_CAPACITY' && body.details?.canMove) {
                        const moves = (body.details.moves as { from: string; to: string; units: number }[])
                            .map((m) => `${m.units} unit${m.units === 1 ? '' : 's'} from ${m.from} to ${m.to}`)
                            .join(', ');
                        const answer = await Swal.fire({
                            icon: 'warning',
                            title: 'A partner on this booking is full',
                            text: `Move ${moves}, then confirm?`,
                            showCancelButton: true,
                            confirmButtonText: 'Move and confirm',
                            cancelButtonText: 'Go back',
                        });
                        if (!answer.isConfirmed) return;
                        res = await fetch(API_URL + 'api/bookings/confirm', putRequestOptions({ ...formData, rebalance: true }));
                        body = await res.json();
                    }

                    if (res.ok) {
                        Swal.fire({
                            icon: 'success',
                            title: 'Success',
                            text: body.moves?.length ? 'Booking confirmed, and the units moved to partners with room.' : 'Booking confirmed successfully!',
                        });
                        setReload(true);
                        setApproverModalShow(false);
                    } else {
                        Swal.fire({
                            icon: 'error',
                            title: 'Error',
                            html: body.message,
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
                const { value: formValues } = await Swal.fire({
                    title: 'Enter Actual Profit',
                    html: `
                        <div class="container text-start">
                            <div class="row mb-3">
                                <label class="col-sm-4 col-form-label">Percentage<span class='text-danger'>*</span></label>
                                <div class="col-sm-8">
                                    <div class="input-group">
                                        <input id="swal-input1" type="number" class="form-control form-control-sm" placeholder="Enter profit %" step="any" />
                                        <span class="input-group-text">%</span>
                                    </div>
                                </div>
                            </div>
                            <div class="row mb-3">
                                <label class="col-sm-4 col-form-label">Amount<span class='text-danger'>*</span></label>
                                <div class="col-sm-8">
                                    <div class="input-group">
                                        <input id="swal-input2" type="number" class="form-control form-control-sm" placeholder="Enter amount" step="any" />
                                        <span class="input-group-text">Tk.</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `,
                    focusConfirm: false,
                    showCancelButton: true,
                    confirmButtonText: 'Submit',
                    showLoaderOnConfirm: true,
                    allowOutsideClick: false,
                    preConfirm: () => {
                        const actualProfitPercentage = (document.getElementById('swal-input1') as HTMLInputElement)?.value;
                        const actualProfitAmount = (document.getElementById('swal-input2') as HTMLInputElement)?.value;
                        if (!actualProfitPercentage || !actualProfitAmount) {
                            Swal.showValidationMessage('Both Actual Profit Percentage and Actual Profit Amount are required.');
                            return false;
                        }
                        return {
                            actualProfitPercentage: parseFloat(actualProfitPercentage),
                            actualProfitAmount: parseFloat(actualProfitAmount),
                        };
                    }
                });

                if (!formValues) return false;

                // Show loader while waiting for API
                Swal.fire({
                    title: 'Processing...',
                    allowOutsideClick: false,
                    allowEscapeKey: false,
                    didOpen: () => {
                        Swal.showLoading();
                    }
                });

                const formData = {
                    idProjectInvestors,
                    investmentStatus,
                    actualProfitPercentage: formValues.actualProfitPercentage,
                    actualProfitAmount: formValues.actualProfitAmount,
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


    const handleManualNotification = async (notificationType: string, idProjectInvestors: number) => {
        Swal.fire({
            title: 'Are you sure?',
            text: `You want to send ${notificationType} weeks notification!`,
            icon: 'warning',
            showCancelButton: true,
            cancelButtonText: 'No',
            confirmButtonText: 'Yes',
            showLoaderOnConfirm: true,
            allowOutsideClick: false,
            preConfirm: async () => {
                try {
                    const formData = {
                        idProjectInvestors,
                        notificationType
                    };
                    const res = await fetch(API_URL + 'api/bookings/manual_notification', putRequestOptions(formData));
                    if (res.status === 200) {
                        Swal.fire({
                            icon: 'success',
                            title: 'Success',
                            text: `${notificationType.charAt(0).toUpperCase() + notificationType.slice(1)} weeks notification sent successfully!`,
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
            },
        });
    }


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

    /** Move the payment deadline later (api/bookings/extend-deadline), with a reason for the history. */
    const handleExtendDeadline = () => {
        const dhakaDay = (ms: number) => new Date(ms + DHAKA_OFFSET_MS).toISOString().slice(0, 10);
        const base = Math.max(Date.now(), details.paymentDueAt ? new Date(details.paymentDueAt).getTime() : 0);
        const suggested = dhakaDay(base + 2 * 24 * 3600 * 1000);
        Swal.fire({
            title: 'Move the payment deadline',
            html:
                `<p style="font-size:14px;margin:0 0 8px">The booking holds its units until the end of the chosen day, Dhaka time.</p>` +
                `<input id="extend-due" type="date" class="swal2-input" min="${dhakaDay(Date.now())}" value="${suggested}">` +
                `<input id="extend-reason" class="swal2-input" maxlength="200" placeholder="Reason (kept in the history)">`,
            showCancelButton: true,
            confirmButtonText: 'Move deadline',
            showLoaderOnConfirm: true,
            allowOutsideClick: false,
            preConfirm: async () => {
                const dueDate = (document.getElementById('extend-due') as HTMLInputElement | null)?.value ?? '';
                const reason = (document.getElementById('extend-reason') as HTMLInputElement | null)?.value.trim() ?? '';
                if (!dueDate || reason.length < 3) {
                    Swal.showValidationMessage('Choose a day and give a reason.');
                    return false;
                }
                try {
                    const res = await fetch(API_URL + 'api/bookings/extend-deadline', putRequestOptions({ idProjectInvestmentBookings: details.idProjectInvestmentBookings, dueDate, reason }));
                    const body = await res.json();
                    if (!res.ok) {
                        Swal.showValidationMessage(body.message || 'The deadline could not be moved.');
                        return false;
                    }
                    return body;
                } catch (err) {
                    Swal.showValidationMessage((err as Error).message || 'Something went wrong!');
                    return false;
                }
            },
        }).then((result) => {
            if (result.isConfirmed) {
                Swal.fire({ icon: 'success', title: 'Deadline moved', text: `Now due ${formatDue(result.value.data.paymentDueAt)} (Dhaka).` });
                setReload(true);
            }
        });
    };

    const handleCancel = async (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        e.preventDefault();
        // A reinvestment's money came from a matured booking: say where it goes back to.
        const source = details.reinvestmentSource?.bookingId ? `booking #${details.reinvestmentSource.bookingId}` : 'the matured booking';
        const reinvestment = details.bookingType === 'reinvestment';
        Swal.fire({
            title: reinvestment ? (details.paymentConfirmationStatus === 'confirmed' ? 'Undo this reinvestment?' : 'Cancel this reinvestment?') : 'Are you sure?',
            text: reinvestment
                ? `Booking #${details.bookingId} is cancelled and its money goes back to ${source}, which is matured again: reinvest it again or pay it out. Balance entries this reinvestment made are reversed; payouts already recorded stay.`
                : 'You want to cancel this booking!',
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
        setPartnerQuery('');
        setPartnerChangeModalShow(true);
    }

    const submitChangePartner = () => {
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
    };

    /*
     * Live updates for one partner allocation. These used to sit behind a
     * "Live Updates" button that opened a dialog asking "Create or List?";
     * the two buttons below go straight to each.
     */
    const openLiveUpdateCreate = (idProjectPartnerInvestors: number) => {
        setLiveUpdateModalShow(true);
        setLiveUpdateFormData({ ...liveUpdateFormData, idProjectPartnerInvestors: idProjectPartnerInvestors.toString() });
    };

    const openLiveUpdateList = (idProjectPartnerInvestors: number) => {
        // Cleared first so one partner's updates never show under another's.
        setLiveUpdateListData([]);
        fetchLiveUpdateList(idProjectPartnerInvestors.toString());
        setLiveUpdateListModalShow(true);
    };

    const paymentMethods = [
        { value: 'cheque', label: 'Cheque' },
        { value: 'beftn', label: 'BEFTN' },
        { value: 'rtgs', label: 'RTGS' },
        { value: 'npsb', label: 'NPSB' },
        { value: 'cash', label: 'Cash' }
    ];

    /* ------------------------------------------------------------ derived */

    /* Keyed on the row id, not `bookingId`: reinvestment bookings can have no
       booking number at all (the list shows them by internal id too). */
    const loaded = Boolean(details.idProjectInvestmentBookings);
    const reference = details.bookingId || details.idProjectInvestmentBookings;
    const lines = details.ProjectInvestors ?? [];
    const figures = lines.map(lineFigures);
    const total = figures.reduce((sum, f) => sum + f.amount, 0);
    /** What the investor owes: projects still in the booking (a dropped one is not). */
    const payable = lines.reduce((sum, l, i) => (l.investmentStatus === 'cancelled' ? sum : sum + figures[i].amount), 0);
    /** One booking, several projects: one transfer and one receipt cover them all. */
    const multi = lines.length > 1;
    const enteredAmount = Number(formData.paymentAmount) || 0;
    const amountGap = Math.round((enteredAmount - payable) * 100) / 100;
    const totalUnits = lines.reduce((sum, l) => sum + Number(l.unitPurchased || 0), 0);
    const backMin = figures.reduce((sum, f) => sum + f.backMin, 0);
    const backMax = figures.reduce((sum, f) => sum + f.backMax, 0);
    const nextMaturity = lines
        .filter((l) => l.maturityDate && !CLOSED_LINE.includes(l.investmentStatus) && daysFromToday(l.maturityDate) >= 0)
        .map((l) => l.maturityDate)
        .sort()[0];

    const pay = paymentStatus(details.paymentConfirmationStatus);
    const nid = investorNidState(details.User);
    const open = details.cancelled === 'no';
    // A reinvestment's amount is the whole booking; the investor pays only what was not carried over.
    const reinvestCarried = details.bookingType === 'reinvestment' ? Number(details.reinvestedAmount) || 0 : 0;
    const reinvestTopUp = details.bookingType === 'reinvestment' ? Math.max(0, Math.round((Number(details.paymentAmount) - reinvestCarried) * 100) / 100) : 0;
    const canCancel = open && details.paymentConfirmationStatus !== 'confirmed';
    /* A reinvestment that moved no new money can be undone after it was
       confirmed (made by mistake: wrong project, units or option), as long as
       nothing has happened to it since. One with a paid top-up needs a refund
       decision, so it is not offered. */
    const canUndoReinvest =
        open &&
        details.bookingType === 'reinvestment' &&
        details.paymentConfirmationStatus === 'confirmed' &&
        reinvestTopUp === 0 &&
        (details.ProjectInvestors ?? []).length > 0 &&
        (details.ProjectInvestors ?? []).every((l) => l.investmentStatus === 'confirmed');
    const canReview = open && isProofSubmitted(details.paymentConfirmationStatus);
    // A booking awaiting payment has a deadline; one past it no longer holds its units.
    const awaitingPayment = open && (details.paymentConfirmationStatus === 'pending' || details.paymentConfirmationStatus === 'denied');
    const expired = details.state === 'expired';
    const canUpload = open && details.paymentConfirmationStatus !== 'confirmed';
    const collects = details.paymentMethod === 'cheque' || details.paymentMethod === 'cash';
    const formCollects = formData.paymentMethod.value === 'cheque' || formData.paymentMethod.value === 'cash';

    /* `!== null` let `undefined` through before the booking had loaded, and
       the page requested /api/files/proof-of-payment/undefined (a 400). */
    const hasProof = Boolean(details.proofOfPayment) && Boolean(details.idProjectInvestmentBookings);
    const proofUrl = `/api/files/proof-of-payment/${details.idProjectInvestmentBookings}`;
    const proofIsPdf = /\.pdf$/i.test(details.proofOfPayment ?? '');

    const partnerNeedle = partnerQuery.trim().toLowerCase();
    const shownPartners = partnerNeedle ? projectPartners.filter((p) => p.label?.toLowerCase().includes(partnerNeedle)) : projectPartners;

    if (loadFailed && !loaded) {
        return (
            <div className="ui">
                <Card className="tw-mx-auto tw-mt-10 tw-max-w-md tw-p-8 tw-text-center">
                    <ShieldAlert className="tw-mx-auto tw-h-8 tw-w-8 tw-text-amber-500" aria-hidden />
                    <h1 className="tw-mt-3 tw-text-lg tw-font-semibold tw-text-slate-900">This booking could not be loaded</h1>
                    <p className="tw-mt-1 tw-text-sm tw-text-slate-500">It may not exist, or the connection dropped. Try again from the bookings list.</p>
                    <Link href="/bookings/list" className="tw-mt-5 tw-inline-flex tw-items-center tw-gap-1.5 tw-text-sm tw-font-semibold tw-text-brand-700 hover:tw-text-brand-600">
                        <ArrowLeft className="tw-h-4 tw-w-4" aria-hidden /> All bookings
                    </Link>
                </Card>
            </div>
        );
    }

    return (
        <div className="ui">
            <Link href="/bookings/list" className="tw-mb-3 tw-inline-flex tw-items-center tw-gap-1.5 tw-text-sm tw-font-medium tw-text-slate-500 hover:tw-text-slate-900">
                <ArrowLeft className="tw-h-4 tw-w-4" aria-hidden /> All bookings
            </Link>

            {/* Header: who, what state, and the decisions waiting on the admin. */}
            <div className="tw-mb-6 tw-flex tw-flex-wrap tw-items-start tw-justify-between tw-gap-4">
                <div className="tw-min-w-0">
                    <p className="tw-text-xs tw-font-semibold tw-uppercase tw-tracking-[0.14em] tw-text-brand-700">Booking</p>
                    {loaded ? (
                        <h1 className="tw-mt-1 tw-text-[26px] tw-font-semibold tw-leading-8 tw-tracking-tight tw-text-slate-900">
                            #{reference}
                            {!details.bookingId && <span className="tw-ml-2 tw-align-middle tw-text-sm tw-font-normal tw-text-slate-400">internal id, no booking number</span>}
                        </h1>
                    ) : (
                        <Skeleton className="tw-mt-2 tw-h-7 tw-w-40" />
                    )}
                    {loaded ? (
                        <div className="tw-mt-2 tw-flex tw-flex-wrap tw-items-center tw-gap-2">
                            <Pill tone={pay.tone}>{pay.label}</Pill>
                            {details.cancelled === 'yes' && <Pill tone="rose">{details.cancelReason === 'expired' ? 'Expired: not paid in time' : 'Cancelled'}</Pill>}
                            {details.cancelled !== 'yes' && expired && <Pill tone="rose">Past its deadline</Pill>}
                            {details.bookingType === 'reinvestment' && <Pill tone="violet">Reinvestment</Pill>}
                            {details.reinvestmentSource?.idProjectInvestmentBookings && (
                                <Link
                                    href={`/bookings/details/${details.reinvestmentSource.idProjectInvestmentBookings}`}
                                    className="tw-text-xs tw-font-semibold tw-text-violet-700 hover:tw-underline"
                                >
                                    from booking #{details.reinvestmentSource.bookingId ?? details.reinvestmentSource.idProjectInvestmentBookings}
                                </Link>
                            )}
                            {details.createdAt && <span className="tw-text-xs tw-text-slate-500">Booked {dhakaStamp(details.createdAt)}</span>}
                        </div>
                    ) : (
                        <Skeleton className="tw-mt-3 tw-h-5 tw-w-64" />
                    )}
                </div>
                {loaded && (canCancel || canReview || canUndoReinvest) && (
                    <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-2">
                        {canCancel && (
                            <Button variant="danger-outline" onClick={handleCancel}>
                                <Ban className="tw-h-4 tw-w-4" aria-hidden /> {details.bookingType === 'reinvestment' ? 'Cancel reinvestment' : 'Cancel booking'}
                            </Button>
                        )}
                        {canUndoReinvest && (
                            <Button variant="danger-outline" onClick={handleCancel}>
                                <Undo2 className="tw-h-4 tw-w-4" aria-hidden /> Undo reinvestment
                            </Button>
                        )}
                        {canReview && (
                            <>
                                <Button onClick={handleDeny}>
                                    <XCircle className="tw-h-4 tw-w-4" aria-hidden /> Deny
                                </Button>
                                <Button variant="primary" onClick={() => setApproverModalShow(true)}>
                                    <CheckCircle2 className="tw-h-4 tw-w-4" aria-hidden /> Confirm payment
                                </Button>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* A reinvestment waiting for its top-up: say exactly what is owed and what to do. */}
            {loaded && reinvestTopUp > 0 && open && details.paymentConfirmationStatus !== 'confirmed' && (
                <div className="tw-mb-5 tw-flex tw-gap-3 tw-rounded-2xl tw-border tw-border-amber-200 tw-bg-amber-50 tw-px-4 tw-py-3 tw-text-sm tw-leading-6 tw-text-amber-900" role="status">
                    <Repeat2 className="tw-mt-1 tw-h-4 tw-w-4 tw-shrink-0" aria-hidden />
                    <div>
                        <p className="tw-font-semibold">Top-up due: {bdtExact(reinvestTopUp)}</p>
                        <p>
                            This reinvestment is {bdtExact(Number(details.paymentAmount))}: {bdtExact(reinvestCarried)} carried over
                            {details.reinvestmentSource?.bookingId ? ` from booking #${details.reinvestmentSource.bookingId}` : ''} and a top-up of{' '}
                            {bdtExact(reinvestTopUp)} from the investor.{' '}
                            {isProofSubmitted(details.paymentConfirmationStatus)
                                ? 'A receipt has been uploaded: check it below, then use Confirm payment and enter the payment date.'
                                : 'The investor can upload the receipt in the app (under pending proof of payment), or you can upload it below.'}{' '}
                            Confirming the payment starts the investment.
                        </p>
                    </div>
                </div>
            )}

            <div className="tw-mb-5">
                <Segmented
                    label="Booking sections"
                    value={tab}
                    onChange={setTab}
                    options={[
                        { value: 'overview', label: 'Overview' },
                        { value: 'activity', label: 'Activity', count: history.length },
                    ]}
                />
            </div>

            {tab === 'overview' && (
                <div className="tw-space-y-6">
                    <div className="tw-grid tw-grid-cols-2 tw-gap-3 lg:tw-grid-cols-4">
                        {loaded ? (
                            <>
                                <Stat icon={Wallet} label="Booking total" value={bdt(total)} hint={plural(lines.length, 'project')} />
                                <Stat icon={Layers} label="Units" value={totalUnits} hint={lines.length === 1 && figures[0]?.unitPrice ? `${bdtExact(figures[0].unitPrice)} each` : 'Across all projects'} />
                                <Stat icon={TrendingUp} label="Expected back" value={total ? bdtRange(backMin, backMax) : '—'} hint="Capital + projected return" />
                                <Stat
                                    icon={CalendarClock}
                                    label="Next maturity"
                                    value={nextMaturity ? date(nextMaturity) : '—'}
                                    hint={nextMaturity ? relativeDays(nextMaturity) : 'Nothing still running'}
                                />
                            </>
                        ) : (
                            [0, 1, 2, 3].map((i) => (
                                <Card key={i} className="tw-p-4">
                                    <Skeleton className="tw-h-3 tw-w-20" />
                                    <Skeleton className="tw-mt-3 tw-h-6 tw-w-28" />
                                </Card>
                            ))
                        )}
                    </div>

                    {loaded && (
                        <div className="tw-grid tw-grid-cols-1 tw-gap-4 lg:tw-grid-cols-3">
                            <Section title="Investor" icon={UserRound}>
                                <div className="tw-flex tw-items-center tw-gap-3">
                                    <Avatar name={details.User?.fullName || '?'} seed={details.idUsers || 0} />
                                    <div className="tw-min-w-0">
                                        {/* Opens everything else this investor holds. */}
                                        <Link
                                            href={`/reports/investors?id=${details.idUsers}`}
                                            className="tw-group tw-inline-flex tw-items-center tw-gap-1 tw-font-semibold tw-text-slate-900 hover:tw-text-brand-700"
                                        >
                                            <span className="tw-truncate">{details.User?.fullName || 'Unknown investor'}</span>
                                            <ArrowUpRight className="tw-h-3.5 tw-w-3.5 tw-shrink-0 tw-text-slate-400 group-hover:tw-text-brand-700" aria-hidden />
                                        </Link>
                                        <div className="tw-text-sm tw-tabular-nums tw-text-slate-500">{details.User?.phoneNumber || '—'}</div>
                                    </div>
                                </div>
                                <dl className="tw-mt-3 tw-divide-y tw-divide-slate-100">
                                    <Fact label="NID">
                                        <span className="tw-inline-flex tw-flex-wrap tw-items-center tw-justify-end tw-gap-2">
                                            <Pill tone={nid.tone}>{nid.label}</Pill>
                                            {!nid.approved && (
                                                <Link href="/users" className="tw-text-xs tw-font-semibold tw-text-brand-700 hover:tw-text-brand-600">
                                                    Review
                                                </Link>
                                            )}
                                        </span>
                                    </Fact>
                                    <Fact label="Bank">{details.UserBank?.Bank?.bankNameFull || dash}</Fact>
                                    <Fact label="Account">
                                        <span className="tw-tabular-nums">{details.UserBank?.accountNumber || dash}</span>
                                    </Fact>
                                    <Fact label="Holder">{details.UserBank?.accountHolderName || dash}</Fact>
                                    {/* Owed to the investor between investments (profit to pay out, leftovers). */}
                                    <Fact label="Held for investor">
                                        <InvestorBalance idUsers={details.idUsers} investorName={details.User?.fullName || 'the investor'} refreshKey={balanceKey} />
                                    </Fact>
                                </dl>
                            </Section>

                            <Section title="Payment" icon={Wallet}>
                                <dl className="tw-divide-y tw-divide-slate-100">
                                    <Fact label="Status">
                                        <Pill tone={pay.tone}>{pay.label}</Pill>
                                    </Fact>
                                    {awaitingPayment && details.paymentDueAt && (
                                        <Fact label="Pay by">
                                            <span className={cx('tw-tabular-nums', expired ? 'tw-text-rose-700' : timeLeft(details.paymentDueAt).match(/^\d+ (h|min)$/) ? 'tw-text-amber-700' : '')}>
                                                {formatDue(details.paymentDueAt)}
                                                <span className="tw-block tw-text-xs tw-font-normal tw-text-slate-500">
                                                    {expired ? 'Passed: the units are free again' : `${timeLeft(details.paymentDueAt)} left, Dhaka time`}
                                                </span>
                                            </span>
                                            <Button size="sm" className="tw-mt-1" onClick={handleExtendDeadline}>Move deadline</Button>
                                        </Fact>
                                    )}
                                    <Fact label="Method">
                                        {/* A reinvestment has no payment method — the money came
                                            from a finished investment, not a transfer. */}
                                        {details.paymentMethod
                                            ? METHOD_LABEL[details.paymentMethod] ?? capitalise(details.paymentMethod)
                                            : details.bookingType === 'reinvestment' ? 'Reinvestment' : dash}
                                    </Fact>
                                    <Fact label="Date">{details.paymentDate ? date(details.paymentDate) : dash}</Fact>
                                    <Fact label="Amount">
                                        <span className="tw-tabular-nums">{details.paymentAmount ? bdtExact(Number(details.paymentAmount)) : dash}</span>
                                    </Fact>
                                    {details.bookingType === 'reinvestment' && (
                                        <>
                                            <Fact label="Carried over">
                                                <span className="tw-tabular-nums">{bdtExact(reinvestCarried)}</span>
                                            </Fact>
                                            <Fact label="Top-up">
                                                <span className={cx('tw-tabular-nums', reinvestTopUp > 0 && 'tw-font-semibold')}>{reinvestTopUp > 0 ? bdtExact(reinvestTopUp) : 'None'}</span>
                                            </Fact>
                                        </>
                                    )}
                                    <Fact label="Transaction ID">
                                        {details.transactionId ? <span className="tw-break-all tw-font-mono tw-text-xs">{details.transactionId}</span> : dash}
                                    </Fact>
                                </dl>
                                {collects && (
                                    <div className="tw-mt-3 tw-rounded-xl tw-bg-slate-50 tw-px-3 tw-py-2">
                                        <p className="tw-pt-1 tw-text-xs tw-font-semibold tw-uppercase tw-tracking-wider tw-text-slate-500">Collection</p>
                                        <dl className="tw-divide-y tw-divide-slate-200/70">
                                            <Fact label="Required">{capitalise(details.collectionRequired)}</Fact>
                                            <Fact label="When">{details.collectionDate ? utcStamp(details.collectionDate) : dash}</Fact>
                                            <Fact label="Where">{details.collectionLocation || dash}</Fact>
                                            <Fact label="Status">
                                                {details.collectionStatus === 'pending' ? (
                                                    <span className="tw-inline-flex tw-gap-1.5">
                                                        <Button size="sm" variant="success" onClick={() => handleCollectionStatusChange(details.idProjectInvestmentBookings, 'collected')}>
                                                            Collected
                                                        </Button>
                                                        <Button size="sm" variant="danger-outline" onClick={() => handleCollectionStatusChange(details.idProjectInvestmentBookings, 'failed')}>
                                                            Failed
                                                        </Button>
                                                    </span>
                                                ) : details.collectionStatus ? (
                                                    <Pill tone={details.collectionStatus === 'collected' ? 'green' : details.collectionStatus === 'failed' ? 'rose' : 'slate'}>
                                                        {capitalise(details.collectionStatus)}
                                                    </Pill>
                                                ) : (
                                                    dash
                                                )}
                                            </Fact>
                                        </dl>
                                    </div>
                                )}
                            </Section>

                            <Section title="Proof of payment" icon={FileText}>
                                {multi && (
                                    <div className="tw-mb-3 tw-rounded-xl tw-border tw-border-violet-200 tw-bg-violet-50 tw-px-3 tw-py-2.5 tw-text-xs tw-leading-5 tw-text-violet-900">
                                        <p className="tw-font-semibold">One receipt for {plural(lines.length, 'project')} · {bdtExact(payable)}</p>
                                        <ul className="tw-mt-1 tw-space-y-0.5">
                                            {lines.map((l, i) => (
                                                <li
                                                    key={l.idProjectInvestors ?? i}
                                                    className={cx('tw-flex tw-justify-between tw-gap-3', l.investmentStatus === 'cancelled' && 'tw-text-violet-400 tw-line-through')}
                                                >
                                                    <span className="tw-truncate">
                                                        {l.Project?.projectName} · {plural(Number(l.unitPurchased || 0), 'unit')}
                                                    </span>
                                                    <span className="tw-tabular-nums">{bdtExact(figures[i].amount)}</span>
                                                </li>
                                            ))}
                                        </ul>
                                        <p className="tw-mt-1 tw-text-violet-700">
                                            The investor pays these together in one transfer. Confirming the payment starts every project in the booking; each then runs, matures and pays out on its own.
                                        </p>
                                    </div>
                                )}
                                {/* Served through an authenticated route, not the public
                                    bucket URL: these are bank receipts and cheque images, and
                                    they used to be readable by anyone holding the link. The
                                    route checks ownership and redirects to a five-minute
                                    presigned URL. */}
                                {hasProof ? (
                                    <a
                                        href={proofUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="tw-group tw-block tw-overflow-hidden tw-rounded-xl tw-border tw-border-slate-200 tw-bg-slate-50 hover:tw-border-slate-300"
                                    >
                                        {proofIsPdf || proofPreviewFailed ? (
                                            <span className="tw-flex tw-h-40 tw-flex-col tw-items-center tw-justify-center tw-gap-2 tw-text-sm tw-text-slate-500">
                                                <FileText className="tw-h-8 tw-w-8 tw-text-slate-400" aria-hidden />
                                                {proofIsPdf ? 'PDF receipt' : 'No preview — open the file'}
                                            </span>
                                        ) : (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={proofUrl} alt="Proof of payment" className="tw-h-40 tw-w-full tw-object-contain" onError={() => setProofPreviewFailed(true)} />
                                        )}
                                        <span className="tw-flex tw-items-center tw-justify-between tw-border-t tw-border-slate-200 tw-bg-white tw-px-3 tw-py-2 tw-text-xs tw-font-medium tw-text-slate-600 group-hover:tw-text-brand-700">
                                            Open full size <ArrowUpRight className="tw-h-3.5 tw-w-3.5" aria-hidden />
                                        </span>
                                    </a>
                                ) : (
                                    <div className="tw-flex tw-h-28 tw-flex-col tw-items-center tw-justify-center tw-gap-1.5 tw-rounded-xl tw-border tw-border-dashed tw-border-slate-200 tw-text-sm tw-text-slate-500">
                                        <ImageOff className="tw-h-5 tw-w-5 tw-text-slate-400" aria-hidden />
                                        No proof submitted yet
                                    </div>
                                )}
                                {canUpload && (
                                    <div className="tw-mt-4">
                                        <label htmlFor="proof-of-payment" className="tw-mb-1.5 tw-block tw-text-xs tw-font-medium tw-text-slate-600">
                                            {hasProof ? 'Replace it with another file' : 'Upload it on the investor’s behalf'}
                                            {multi ? ` (one receipt for all ${lines.length} projects)` : ''}
                                        </label>
                                        <FileInput id="proof-of-payment" onChange={handleFileChange} ref={proofOfPaymentRef} />
                                        <Button size="sm" variant="primary" className="tw-mt-2" onClick={handleFileUpload}>
                                            <Upload className="tw-h-3.5 tw-w-3.5" aria-hidden /> Upload
                                        </Button>
                                    </div>
                                )}
                            </Section>
                        </div>
                    )}

                    {loaded && (
                        <section>
                            <div className="tw-mb-3 tw-flex tw-flex-wrap tw-items-end tw-justify-between tw-gap-2">
                                <div>
                                    <h2 className="tw-text-lg tw-font-semibold tw-tracking-tight tw-text-slate-900">Investments</h2>
                                    <p className="tw-text-sm tw-text-slate-500">
                                        {plural(lines.length, 'project')} · {plural(totalUnits, 'unit')} · total payable {bdt(total)}
                                    </p>
                                </div>
                            </div>

                            <div className="tw-space-y-4">
                                {lines.map((line, index) => {
                                    const f = figures[index];
                                    const st = investmentStatus(line.investmentStatus);
                                    const closed = CLOSED_LINE.includes(line.investmentStatus);
                                    const canNotify = open && !closed;
                                    /* Not offered on a line that is already paid out, rolled over
                                       or cancelled: the API does not check, and pressing it there
                                       would put a finished line back to "payout due" and overwrite
                                       its recorded profit. */
                                    const canWithdraw =
                                        open && details.paymentConfirmationStatus === 'confirmed' && line.investmentStatus !== 'ready_for_withdrawal' && !closed;
                                    /* Matured: marked ready (or the investor asked to withdraw), or
                                       still active past its maturity date. The API checks again. */
                                    const matured =
                                        ['ready_for_withdrawal', 'request_withdrawal'].includes(line.investmentStatus) ||
                                        (line.investmentStatus === 'confirmed' && Boolean(line.maturityDate) && daysFromToday(line.maturityDate) <= 0);
                                    const canReinvest = open && details.paymentConfirmationStatus === 'confirmed' && !closed && matured;
                                    const request = line.ProjectSpecialBookingReq;
                                    return (
                                        <Card key={line.idProjectInvestors ?? index} className="tw-overflow-hidden">
                                            <div className="tw-flex tw-flex-wrap tw-items-start tw-justify-between tw-gap-3 tw-px-5 tw-py-4">
                                                <div className="tw-min-w-0">
                                                    <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-2">
                                                        <span className="tw-inline-flex tw-h-6 tw-w-6 tw-items-center tw-justify-center tw-rounded-lg tw-bg-slate-100 tw-text-xs tw-font-semibold tw-tabular-nums tw-text-slate-500">
                                                            {index + 1}
                                                        </span>
                                                        <Link
                                                            href={`/projects/details/${line.Project?.idProjects}`}
                                                            className="tw-group tw-inline-flex tw-items-center tw-gap-1 tw-text-base tw-font-semibold tw-text-slate-900 hover:tw-text-brand-700"
                                                        >
                                                            {line.Project?.projectName}
                                                            <ArrowUpRight className="tw-h-3.5 tw-w-3.5 tw-text-slate-400 group-hover:tw-text-brand-700" aria-hidden />
                                                        </Link>
                                                        <Pill tone={st.tone}>{st.label}</Pill>
                                                    </div>
                                                    <p className="tw-mt-1 tw-text-sm tw-text-slate-500">
                                                        Invested {date(line.investmentDate)} · {line.Project?.duration} {line.Project?.tenure} ·{' '}
                                                        {line.Project?.returnRangeMin}–{line.Project?.returnRangeMax}% return
                                                    </p>
                                                </div>
                                                <div className="sm:tw-text-right">
                                                    <div className="tw-text-lg tw-font-semibold tw-tabular-nums tw-text-slate-900">{bdt(f.amount)}</div>
                                                    <div className="tw-text-xs tw-tabular-nums tw-text-slate-500">
                                                        {plural(Number(line.unitPurchased || 0), 'unit')} × {f.unitPrice !== null ? bdtExact(f.unitPrice) : '—'}
                                                    </div>
                                                </div>
                                            </div>

                                            <dl className="tw-grid tw-grid-cols-2 tw-border-y tw-border-slate-100 tw-bg-slate-50/60 sm:tw-grid-cols-4">
                                                {(
                                                    [
                                                        ['Expected back', `${bdt(f.backMin)} – ${bdt(f.backMax)}`],
                                                        ['Starts', date(line.projectStartDate)],
                                                        ['Matures', date(line.maturityDate)],
                                                        ['Remaining', closed ? '—' : remainingLabel(line.maturityDate)],
                                                    ] as [string, string][]
                                                ).map(([label, value]) => (
                                                    <div key={label} className="tw-px-5 tw-py-3">
                                                        <dt className="tw-text-xs tw-text-slate-500">{label}</dt>
                                                        <dd className="tw-mt-0.5 tw-text-sm tw-font-medium tw-tabular-nums tw-text-slate-900">{value}</dd>
                                                    </div>
                                                ))}
                                            </dl>

                                            {(line.actualProfitAmount !== null && line.actualProfitAmount !== undefined) ||
                                            (line.actualProfitPercentage !== null && line.actualProfitPercentage !== undefined) ? (
                                                <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-x-6 tw-gap-y-1 tw-border-b tw-border-slate-100 tw-bg-emerald-50/50 tw-px-5 tw-py-2.5 tw-text-sm">
                                                    <span className="tw-font-medium tw-text-emerald-800">Actual profit</span>
                                                    <span className="tw-tabular-nums tw-text-slate-800">
                                                        {line.actualProfitAmount !== null && line.actualProfitAmount !== undefined ? bdtExact(Number(line.actualProfitAmount)) : '—'}
                                                    </span>
                                                    <span className="tw-tabular-nums tw-text-slate-600">
                                                        {line.actualProfitPercentage !== null && line.actualProfitPercentage !== undefined ? `${line.actualProfitPercentage}%` : ''}
                                                    </span>
                                                </div>
                                            ) : null}

                                            {request && (
                                                <div className="tw-border-b tw-border-slate-100 tw-px-5 tw-py-3">
                                                    <p className="tw-text-xs tw-font-semibold tw-uppercase tw-tracking-wider tw-text-slate-500">Special request</p>
                                                    <dl className="tw-mt-1.5 tw-grid tw-grid-cols-1 tw-gap-x-6 tw-gap-y-1 tw-text-sm sm:tw-grid-cols-2">
                                                        {(
                                                            [
                                                                ['Request', request.additionalRequest],
                                                                ['Delivery', request.deliveryLocation],
                                                                ['Colour', request.preferredColor],
                                                                ['Preferred price', request.preferredProductPrice ? bdtExact(Number(request.preferredProductPrice)) : ''],
                                                            ] as [string, React.ReactNode][]
                                                        ).map(([label, value]) => (
                                                            <div key={label} className="tw-flex tw-gap-2">
                                                                <dt className="tw-w-28 tw-shrink-0 tw-text-slate-500">{label}</dt>
                                                                <dd className="tw-min-w-0 tw-text-slate-800">{value || '—'}</dd>
                                                            </div>
                                                        ))}
                                                    </dl>
                                                </div>
                                            )}

                                            <div className="tw-px-5 tw-py-3">
                                                <p className="tw-text-xs tw-font-semibold tw-uppercase tw-tracking-wider tw-text-slate-500">Partners</p>
                                                {line.ProjectPartnerInvestors.length === 0 && (
                                                    <p className="tw-py-2 tw-text-sm tw-text-slate-500">No partner allocation is recorded on this line.</p>
                                                )}
                                                <ul className="tw-mt-1 tw-divide-y tw-divide-slate-100">
                                                    {line.ProjectPartnerInvestors.map((partner) => {
                                                        const capacity = Number(partner.ProjectPartner?.partnerUnitCapacity || 0);
                                                        const room = Number(partner.ProjectPartner?.remainingCapacity ?? 0);
                                                        /* A capacity of 0 means "no limit" (as the confirm API
                                                           reads it); such a partner is never over capacity. */
                                                        const overCapacity =
                                                            open && details.paymentConfirmationStatus !== 'confirmed' && capacity > 0 && partner.investedUnit > room;
                                                        const partnerUser = partner.ProjectPartner?.User;
                                                        return (
                                                            <li key={partner.idProjectPartnerInvestors} className="tw-flex tw-flex-wrap tw-items-center tw-gap-3 tw-py-2.5">
                                                                <Avatar name={partnerUser?.fullName || '?'} seed={partnerUser?.idUsers || 0} size="sm" />
                                                                {/* min width: on a phone the buttons drop under the name
                                                                    rather than squeezing it onto two lines. */}
                                                                <div className="tw-min-w-[11rem] tw-flex-1">
                                                                    <Link
                                                                        href={`/partners/details/${partnerUser?.idUsers}`}
                                                                        className="tw-text-sm tw-font-medium tw-text-slate-900 hover:tw-text-brand-700"
                                                                    >
                                                                        {partnerUser?.fullName || 'Unknown partner'}
                                                                    </Link>
                                                                    <div className="tw-text-xs tw-tabular-nums tw-text-slate-500">
                                                                        {plural(Number(partner.investedUnit || 0), 'unit')} · {bdt(Number(partner.amountInvested || 0))}
                                                                    </div>
                                                                    {overCapacity && (
                                                                        <div className="tw-mt-1 tw-inline-flex tw-items-center tw-gap-1 tw-text-xs tw-font-medium tw-text-amber-700">
                                                                            <ShieldAlert className="tw-h-3.5 tw-w-3.5" aria-hidden />
                                                                            More units than this partner has room for ({Math.max(room, 0)} left of {capacity})
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div className="tw-ml-11 tw-flex tw-flex-wrap tw-items-center tw-gap-1.5 sm:tw-ml-0">
                                                                    {overCapacity && (
                                                                        <Button
                                                                            size="sm"
                                                                            variant="secondary"
                                                                            className="tw-border-amber-300 tw-text-amber-800 hover:tw-bg-amber-50"
                                                                            onClick={() => handleChangePartner(line.Project.idProjects, partner.idProjectPartnerInvestors)}
                                                                        >
                                                                            <Repeat2 className="tw-h-3.5 tw-w-3.5" aria-hidden /> Change partner
                                                                        </Button>
                                                                    )}
                                                                    {open && (
                                                                        <>
                                                                            <Button size="sm" variant="ghost" onClick={() => openLiveUpdateList(partner.idProjectPartnerInvestors)}>
                                                                                <ListChecks className="tw-h-3.5 tw-w-3.5" aria-hidden /> Updates
                                                                            </Button>
                                                                            <Button size="sm" variant="secondary" onClick={() => openLiveUpdateCreate(partner.idProjectPartnerInvestors)}>
                                                                                <Plus className="tw-h-3.5 tw-w-3.5" aria-hidden /> Add update
                                                                            </Button>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </li>
                                                        );
                                                    })}
                                                </ul>
                                            </div>

                                            {canReinvest && (
                                                <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-3 tw-border-t tw-border-emerald-100 tw-bg-emerald-50/70 tw-px-5 tw-py-3">
                                                    <p className="tw-text-sm tw-text-emerald-900">
                                                        <span className="tw-font-semibold">Matured.</span> Reinvest it into a new booking, or pay it out.
                                                    </p>
                                                    <Button size="sm" variant="primary" className="tw-ml-auto" onClick={() => setReinvestLine(line.idProjectInvestors)}>
                                                        <Repeat2 className="tw-h-3.5 tw-w-3.5" aria-hidden /> Reinvest…
                                                    </Button>
                                                </div>
                                            )}
                                            {(canWithdraw || canNotify) && (
                                                <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-2 tw-border-t tw-border-slate-100 tw-bg-slate-50/60 tw-px-5 tw-py-3">
                                                    {canWithdraw && (
                                                        <Button size="sm" variant={canReinvest ? 'secondary' : 'primary'} onClick={() => handleInvestmentStatusChange(line.idProjectInvestors, 'ready_for_withdrawal')}>
                                                            <Wallet className="tw-h-3.5 tw-w-3.5" aria-hidden /> Mark ready for withdrawal
                                                        </Button>
                                                    )}
                                                    {canNotify && (
                                                        <span className="tw-ml-auto tw-flex tw-flex-wrap tw-items-center tw-gap-1.5">
                                                            <span className="tw-text-xs tw-text-slate-500">Send maturity notice:</span>
                                                            <Button size="sm" onClick={() => handleManualNotification('2', line.idProjectInvestors)}>
                                                                <BellRing className="tw-h-3.5 tw-w-3.5" aria-hidden /> 2 weeks
                                                            </Button>
                                                            <Button size="sm" onClick={() => handleManualNotification('1', line.idProjectInvestors)}>
                                                                <BellRing className="tw-h-3.5 tw-w-3.5" aria-hidden /> 1 week
                                                            </Button>
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </Card>
                                    );
                                })}
                            </div>
                        </section>
                    )}
                </div>
            )}

            {tab === 'activity' && (
                <Card className="tw-p-5">
                    {history.length === 0 ? (
                        <div className="tw-flex tw-flex-col tw-items-center tw-gap-2 tw-py-10 tw-text-sm tw-text-slate-500">
                            <HistoryIcon className="tw-h-6 tw-w-6 tw-text-slate-400" aria-hidden />
                            {loaded ? 'Nothing has happened on this booking yet.' : 'Loading…'}
                        </div>
                    ) : (
                        <div className="tw-relative">
                        <span className="tw-absolute tw-bottom-3 tw-left-[11px] tw-top-3 tw-w-px tw-bg-slate-200" aria-hidden />
                        <ol>
                            {history.map((item, index) => (
                                <li key={index} className="tw-relative tw-flex tw-gap-4 tw-pb-5 last:tw-pb-0">
                                    <span className="tw-relative tw-mt-0.5 tw-flex tw-h-6 tw-w-6 tw-shrink-0 tw-items-center tw-justify-center tw-rounded-full tw-bg-white">
                                        <span className={cx('tw-h-2.5 tw-w-2.5 tw-rounded-full tw-ring-4 tw-ring-white', HISTORY_DOT[historyTone(item.status)])} />
                                    </span>
                                    <div className="tw-min-w-0 tw-flex-1">
                                        <div className="tw-flex tw-flex-wrap tw-items-baseline tw-justify-between tw-gap-x-3">
                                            <p className="tw-text-sm tw-font-semibold tw-text-slate-900">{capitalise(item.status)}</p>
                                            <time className="tw-text-xs tw-tabular-nums tw-text-slate-500">
                                                {item.createdAt ? dhakaStamp(item.createdAt) : item.createdAtFormatted}
                                            </time>
                                        </div>
                                        <p className="tw-text-xs tw-text-slate-500">by {item.User?.fullName || 'system'}</p>
                                        {item.remarks && (
                                            <p className="tw-mt-1.5 tw-whitespace-pre-line tw-rounded-lg tw-bg-slate-50 tw-px-3 tw-py-2 tw-text-sm tw-text-slate-700">{item.remarks}</p>
                                        )}
                                    </div>
                                </li>
                            ))}
                        </ol>
                        </div>
                    )}
                </Card>
            )}

            <Modal show={approverModalShow} onHide={() => setApproverModalShow(false)} size='lg'>
                <Modal.Header closeButton>
                    <Modal.Title>Confirm payment · #{reference}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <form onSubmit={handleSubmit} className="ui tw-space-y-4">
                        {/* Shown, never enforced: confirming still works. An
                            approved NID is no longer required to book, so this is
                            the one moment the admin is told before money is
                            recorded against the investor. */}
                        {details.User && !nid.approved && (
                            <div className="tw-flex tw-gap-2 tw-rounded-xl tw-border tw-border-amber-200 tw-bg-amber-50 tw-px-3 tw-py-2.5 tw-text-sm tw-text-amber-900" role="alert">
                                <ShieldAlert className="tw-mt-0.5 tw-h-4 tw-w-4 tw-shrink-0" aria-hidden />
                                <span>
                                    This investor&apos;s NID is not approved ({nid.label.toLowerCase()}). You can still confirm the booking.
                                </span>
                            </div>
                        )}
                        <div className="tw-flex tw-flex-wrap tw-items-center tw-justify-between tw-gap-2 tw-rounded-xl tw-bg-slate-50 tw-px-4 tw-py-3 tw-text-sm">
                            <span className="tw-text-slate-600">
                                {details.User?.fullName} · {plural(totalUnits, 'unit')}
                            </span>
                            <span className="tw-font-semibold tw-tabular-nums tw-text-slate-900">Booking total {bdt(payable)}</span>
                        </div>
                        {multi && (
                            <div className="tw-rounded-xl tw-border tw-border-slate-200 tw-px-4 tw-py-3 tw-text-sm">
                                <p className="tw-mb-1.5 tw-text-xs tw-font-semibold tw-uppercase tw-tracking-wider tw-text-slate-500">
                                    One payment covers {plural(lines.length, 'project')}
                                </p>
                                <ul className="tw-space-y-1">
                                    {lines.map((l, i) => (
                                        <li
                                            key={l.idProjectInvestors ?? i}
                                            className={cx('tw-flex tw-justify-between tw-gap-3', l.investmentStatus === 'cancelled' && 'tw-text-slate-400 tw-line-through')}
                                        >
                                            <span className="tw-truncate tw-text-slate-700">
                                                {l.Project?.projectName} · {plural(Number(l.unitPurchased || 0), 'unit')}
                                            </span>
                                            <span className="tw-tabular-nums tw-text-slate-900">{bdtExact(figures[i].amount)}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        <div className="tw-grid tw-grid-cols-1 tw-gap-4 sm:tw-grid-cols-2">
                            <Field label={<>Payment method<Required /></>}>
                                <Select
                                    id="paymentMethod"
                                    value={formData.paymentMethod.value || ''}
                                    onChange={(e) => {
                                        const method = paymentMethods.find((m) => m.value === e.target.value);
                                        if (method) setFormData({ ...formData, paymentMethod: method });
                                    }}
                                >
                                    <option value="" disabled>
                                        Choose a method
                                    </option>
                                    {paymentMethods.map((method) => (
                                        <option key={method.value} value={method.value}>
                                            {method.label}
                                        </option>
                                    ))}
                                </Select>
                            </Field>
                            {formCollects ? (
                                <>
                                    <Field label={<>Collection date<Required /></>}>
                                        <Input type='datetime-local' name='collectionDate' value={formData.collectionDate ?? ''} onChange={handleOnChange} />
                                    </Field>
                                    <Field label={<>Collection location<Required /></>} className="sm:tw-col-span-2">
                                        <Input type='text' name='collectionLocation' value={formData.collectionLocation ?? ''} onChange={handleOnChange} />
                                    </Field>
                                </>
                            ) : (
                                <Field label={<>Investor bank<Required /></>}>
                                    <Select
                                        id="idUserBanks"
                                        value={formData.idUserBanks ?? ''}
                                        onChange={(e) => setFormData({ ...formData, idUserBanks: Number(e.target.value) })}
                                    >
                                        <option value="" disabled>
                                            {userBanks.length ? 'Choose an account' : 'No bank accounts on file'}
                                        </option>
                                        {userBanks.map((bank) => (
                                            <option key={bank.idUserBanks} value={bank.idUserBanks}>
                                                {`${bank.Bank.bankNameFull} - ${bank.BankBranch.branchName} - ${bank.accountNumber}`}
                                            </option>
                                        ))}
                                    </Select>
                                </Field>
                            )}
                            <Field label={<>Payment date<Required /></>} hint={details.bookingType === 'reinvestment' ? 'The investment starts on this date.' : undefined}>
                                <Input type='date' name='paymentDate' value={formData.paymentDate ?? ''} onChange={handleOnChange} />
                            </Field>
                            {details.bookingType === 'reinvestment' ? (
                                <Field
                                    label={<>Whole booking amount (৳)<Required /></>}
                                    hint={`${bdtExact(reinvestCarried)} carried over + the top-up received (${bdtExact(reinvestTopUp)} was due).`}
                                >
                                    <Input type='number' name='paymentAmount' value={formData.paymentAmount ?? ''} onChange={handleOnChange} />
                                </Field>
                            ) : (
                                <Field
                                    label={<>Amount received (৳)<Required /></>}
                                    hint={
                                        enteredAmount > 0 && Math.abs(amountGap) >= 1
                                            ? `${amountGap > 0 ? 'More' : 'Less'} than the booking total (${bdtExact(payable)}) by ${bdtExact(Math.abs(amountGap))}. Check the receipt${multi ? ': one transfer should cover every project above' : ''}.`
                                            : multi
                                            ? 'The whole transfer, for every project above.'
                                            : undefined
                                    }
                                >
                                    <Input type='number' name='paymentAmount' value={formData.paymentAmount ?? ''} onChange={handleOnChange} />
                                </Field>
                            )}
                            <Field label={<>Transaction ID<Required /></>} className="sm:tw-col-span-2">
                                <Input type='text' name='transactionId' value={formData.transactionId ?? ''} onChange={handleOnChange} />
                            </Field>
                        </div>
                        <div className="tw-flex tw-justify-end tw-gap-2 tw-border-t tw-border-slate-100 tw-pt-4">
                            <Button onClick={() => setApproverModalShow(false)}>Cancel</Button>
                            <Button variant="primary" type="submit">
                                <Check className="tw-h-4 tw-w-4" aria-hidden /> Confirm payment
                            </Button>
                        </div>
                    </form>
                </Modal.Body>
            </Modal>

            <Modal show={liveUpdateModalShow} onHide={() => setLiveUpdateModalShow(false)} size='lg'>
                <Modal.Header closeButton>
                    <Modal.Title>New live update</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <form onSubmit={handleLiveUpdateSubmit} className="ui tw-space-y-4">
                        <p className="tw-text-sm tw-text-slate-500">Shown to the investor in the app, under this partner&apos;s share of the project.</p>
                        <div className="tw-grid tw-grid-cols-1 tw-gap-4 sm:tw-grid-cols-2">
                            <Field label={<>Update date<Required /></>}>
                                <Input type='date' name='updateDate' value={liveUpdateFormData.updateDate} onChange={(e) => setLiveUpdateFormData({ ...liveUpdateFormData, updateDate: e.target.value })} />
                            </Field>
                            <Field label="Live weight">
                                <Input
                                    type='number'
                                    step='any'
                                    name='liveWeight'
                                    value={liveUpdateFormData.liveWeight ?? ''}
                                    onChange={(e) => setLiveUpdateFormData({ ...liveUpdateFormData, liveWeight: e.target.value === '' ? null : Number(e.target.value) })}
                                />
                            </Field>
                            <Field label={<>Title<Required /></>} className="sm:tw-col-span-2">
                                <Input type='text' name='updateTitle' value={liveUpdateFormData.updateTitle} onChange={(e) => setLiveUpdateFormData({ ...liveUpdateFormData, updateTitle: e.target.value })} />
                            </Field>
                            <Field label={<>Details<Required /></>} className="sm:tw-col-span-2">
                                <Textarea name='updateBody' value={liveUpdateFormData.updateBody} onChange={(e) => setLiveUpdateFormData({ ...liveUpdateFormData, updateBody: e.target.value })} />
                            </Field>
                            <Field label="Video link">
                                <Input type='text' name='videoUrl' placeholder="https://" value={liveUpdateFormData.videoUrl} onChange={(e) => setLiveUpdateFormData({ ...liveUpdateFormData, videoUrl: e.target.value })} />
                            </Field>
                            <Field label="Photo">
                                <FileInput
                                    name='updateImage'
                                    accept="image/*"
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                        const file = e.target.files?.[0] || null;
                                        setLiveUpdateFormData({
                                            ...liveUpdateFormData,
                                            updateImage: file
                                        });
                                    }}
                                />
                            </Field>
                        </div>
                        <div className="tw-flex tw-justify-end tw-gap-2 tw-border-t tw-border-slate-100 tw-pt-4">
                            <Button onClick={() => setLiveUpdateModalShow(false)}>Cancel</Button>
                            <Button variant="primary" type="submit">
                                Post update
                            </Button>
                        </div>
                    </form>
                </Modal.Body>
            </Modal>

            <Modal show={liveUpdateListModalShow} onHide={() => setLiveUpdateListModalShow(false)} size='lg'>
                <Modal.Header closeButton>
                    <Modal.Title>Live updates</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <div className="ui">
                        {liveUpdateListLoading ? (
                            <div className="tw-space-y-3">
                                {[0, 1].map((i) => (
                                    <div key={i} className="tw-flex tw-gap-4 tw-rounded-xl tw-border tw-border-slate-200 tw-p-3">
                                        <Skeleton className="tw-h-20 tw-w-20 tw-rounded-lg" />
                                        <div className="tw-flex-1 tw-space-y-2">
                                            <Skeleton className="tw-h-4 tw-w-40" />
                                            <Skeleton className="tw-h-3 tw-w-full" />
                                            <Skeleton className="tw-h-3 tw-w-2/3" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : liveUpdateListData.length === 0 ? (
                            <div className="tw-flex tw-flex-col tw-items-center tw-gap-2 tw-py-10 tw-text-sm tw-text-slate-500">
                                <ListChecks className="tw-h-6 tw-w-6 tw-text-slate-400" aria-hidden />
                                No live updates posted yet.
                            </div>
                        ) : (
                            <ul className="tw-space-y-3">
                                {liveUpdateListData.map((liveUpdate, index) => (
                                    <li key={liveUpdate.idProjectPartnerInvestorUpdates ?? index} className="tw-flex tw-gap-4 tw-rounded-xl tw-border tw-border-slate-200 tw-p-3">
                                        {liveUpdate.updateImage ? (
                                            <a
                                                href={`${S3_URL}live-update/${liveUpdate.idProjectPartnerInvestorUpdates}/${liveUpdate.updateImage}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="tw-shrink-0"
                                            >
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img
                                                    src={`${S3_URL}live-update/${liveUpdate.idProjectPartnerInvestorUpdates}/${liveUpdate.imageThumbnail}`}
                                                    alt={liveUpdate.updateTitle || 'Live update photo'}
                                                    className="tw-h-20 tw-w-20 tw-rounded-lg tw-bg-slate-100 tw-object-cover"
                                                />
                                            </a>
                                        ) : (
                                            <span className="tw-flex tw-h-20 tw-w-20 tw-shrink-0 tw-items-center tw-justify-center tw-rounded-lg tw-bg-slate-50">
                                                <ImageOff className="tw-h-5 tw-w-5 tw-text-slate-300" aria-hidden />
                                            </span>
                                        )}
                                        <div className="tw-min-w-0 tw-flex-1">
                                            <div className="tw-flex tw-flex-wrap tw-items-baseline tw-justify-between tw-gap-2">
                                                <p className="tw-font-semibold tw-text-slate-900">{liveUpdate.updateTitle}</p>
                                                <span className="tw-text-xs tw-tabular-nums tw-text-slate-500">{date(liveUpdate.updateDate)}</span>
                                            </div>
                                            <p className="tw-mt-1 tw-whitespace-pre-line tw-text-sm tw-text-slate-600">{liveUpdate.updateBody}</p>
                                            <div className="tw-mt-2 tw-flex tw-flex-wrap tw-items-center tw-gap-3 tw-text-xs">
                                                {liveUpdate.liveWeight !== null && liveUpdate.liveWeight !== undefined && (
                                                    <span className="tw-rounded-md tw-bg-slate-100 tw-px-2 tw-py-0.5 tw-font-medium tw-tabular-nums tw-text-slate-700">
                                                        Live weight {liveUpdate.liveWeight}
                                                    </span>
                                                )}
                                                {liveUpdate.videoUrl && (
                                                    <a
                                                        href={liveUpdate.videoUrl.startsWith('http') ? liveUpdate.videoUrl : `http://${liveUpdate.videoUrl}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="tw-inline-flex tw-items-center tw-gap-1 tw-font-semibold tw-text-brand-700 hover:tw-text-brand-600"
                                                    >
                                                        <PlayCircle className="tw-h-3.5 tw-w-3.5" aria-hidden /> Watch video
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </Modal.Body>
            </Modal>

            <Modal show={partnerChangeModalShow} onHide={() => setPartnerChangeModalShow(false)} size='lg'>
                <Modal.Header closeButton>
                    <Modal.Title>Change partner</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <div className="ui tw-space-y-3">
                        <p className="tw-text-sm tw-text-slate-500">
                            Move this allocation to another partner on the project. Only partners below their capacity are listed.
                        </p>
                        <SearchInput placeholder="Search partners" value={partnerQuery} onChange={(e) => setPartnerQuery(e.target.value)} aria-label="Search partners" />
                        <div role="radiogroup" aria-label="Partners" className="tw-max-h-80 tw-space-y-2 tw-overflow-y-auto tw-pr-1">
                            {shownPartners.length === 0 ? (
                                <p className="tw-py-8 tw-text-center tw-text-sm tw-text-slate-500">
                                    {projectPartners.length ? 'No partner matches that search.' : 'No partner on this project has room.'}
                                </p>
                            ) : (
                                shownPartners.map((partner) => {
                                    const selected = changePartnerFormData.idProjectPartners === partner.value;
                                    const capacity = Number(partner.partnerUnitCapacity || 0);
                                    const confirmedUnits = Number(partner.confirmedUnits || 0);
                                    const pendingUnits = Number(partner.pendingUnits || 0);
                                    return (
                                        <label
                                            key={partner.value}
                                            className={cx(
                                                'tw-flex tw-cursor-pointer tw-items-center tw-gap-3 tw-rounded-xl tw-border tw-px-3 tw-py-2.5 tw-transition',
                                                selected ? 'tw-border-brand-500 tw-bg-brand-50/60 tw-ring-2 tw-ring-brand-500/15' : 'tw-border-slate-200 hover:tw-border-slate-300 hover:tw-bg-slate-50',
                                            )}
                                        >
                                            <input
                                                type="radio"
                                                name="partner"
                                                className="tw-sr-only"
                                                checked={selected}
                                                onChange={() => setChangePartnerFormData({ ...changePartnerFormData, idProjectPartners: partner.value })}
                                            />
                                            <Avatar name={partner.label || '?'} seed={partner.value} size="sm" />
                                            <span className="tw-min-w-0 tw-flex-1">
                                                <span className="tw-block tw-truncate tw-text-sm tw-font-medium tw-text-slate-900">{partner.label}</span>
                                                <span className="tw-block tw-text-xs tw-tabular-nums tw-text-slate-500">
                                                    {capacity > 0 ? `Capacity ${capacity}` : 'No capacity limit'} · {confirmedUnits} paid ·{' '}
                                                    {pendingUnits} awaiting payment
                                                    {capacity > 0 ? ` · ${Math.max(0, capacity - confirmedUnits - pendingUnits)} left` : ''}
                                                </span>
                                            </span>
                                            <span
                                                className={cx(
                                                    'tw-flex tw-h-5 tw-w-5 tw-shrink-0 tw-items-center tw-justify-center tw-rounded-full tw-border',
                                                    selected ? 'tw-border-brand-600 tw-bg-brand-600 tw-text-white' : 'tw-border-slate-300 tw-bg-white',
                                                )}
                                                aria-hidden
                                            >
                                                {selected && <Check className="tw-h-3 tw-w-3" />}
                                            </span>
                                        </label>
                                    );
                                })
                            )}
                        </div>
                        <div className="tw-flex tw-justify-end tw-gap-2 tw-border-t tw-border-slate-100 tw-pt-4">
                            <Button onClick={() => setPartnerChangeModalShow(false)}>Cancel</Button>
                            <Button variant="primary" onClick={submitChangePartner} disabled={!changePartnerFormData.idProjectPartners}>
                                <Repeat2 className="tw-h-4 tw-w-4" aria-hidden /> Change partner
                            </Button>
                        </div>
                    </div>
                </Modal.Body>
            </Modal>

            <ReinvestDialog
                idProjectInvestors={reinvestLine}
                onClose={() => setReinvestLine(null)}
                onDone={() => {
                    setReload(true);
                    setBalanceKey((k) => k + 1);
                }}
            />
        </div>
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
