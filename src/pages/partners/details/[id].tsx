import React, { useState, useEffect } from "react";
import Link from "next/link";
import MainLayout from "@/layouts/MainLayout";
import { useRouter } from "next/router";
import { getRequestOptions } from "@/utils/Fetch";
import { S3_URL } from '@/config/public';
import Swal from "sweetalert2";
import { ArrowLeft, ArrowUpRight, FolderKanban, Home, ImageOff, Pencil, ShieldAlert, UserRound } from "lucide-react";
import { Avatar, Card, Pill, SafeImg, Skeleton, cx } from "@/ui/primitives";
import { LinkButton } from "@/ui/controls";
import { EmptyRow, TableCard, TD, TH, TR } from "@/ui/layout";
import { date } from "@/ui/format";
import { words } from "@/ui/status";

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
    PartnerAdditionalInfo?: {
        gender: 'Male' | 'Female' | 'Other',
        household_size: string,
        dependents_size: string,
        livelihood_activity: string,
        primary_goal: string
    },
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

const TYPE_TONE: Record<string, 'green' | 'sky' | 'violet' | 'slate'> = { project: 'green', product: 'sky', both: 'violet', none: 'slate' };

function Fact({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
    return (
        <div className={cx(wide && 'sm:tw-col-span-2')}>
            <dt className="tw-text-xs tw-font-medium tw-text-slate-500">{label}</dt>
            <dd className="tw-mt-0.5 tw-whitespace-pre-line tw-break-words tw-text-sm tw-text-slate-800">{children || <span className="tw-text-slate-400">—</span>}</dd>
        </div>
    );
}

function Details() {
    const router = useRouter();
    const { id } = router.query;
    const [details, setDetails] = useState<DetailsProps>({} as DetailsProps);
    const [loadFailed, setLoadFailed] = useState<boolean>(false);

    useEffect(() => {
        if (id != undefined) {
            const fetchPartnerDetails = async () => {
                try {
                    const res = await fetch('/api/partners/details/' + id, getRequestOptions());
                    const data = await res.json();
                    if (res.status === 200 && data.data) {
                        setDetails(data.data);
                    } else {
                        setLoadFailed(true);
                        Swal.fire({
                            icon: 'error',
                            title: 'Error',
                            text: data.message || 'Partner not found.',
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
            fetchPartnerDetails();
        }
    }, [id])

    const loaded = Boolean(details.idUsers);
    const info = details.PartnerAdditionalInfo;
    const partnerships = details.Partnerships ?? [];
    const images = details.FeaturedImages ?? [];
    const skillList = (details.skills || '').split(',').map((s) => s.trim()).filter(Boolean);

    if (loadFailed && !loaded) {
        return (
            <div className="ui">
                <Card className="tw-mx-auto tw-mt-10 tw-max-w-md tw-p-8 tw-text-center">
                    <ShieldAlert className="tw-mx-auto tw-h-8 tw-w-8 tw-text-amber-500" aria-hidden />
                    <h1 className="tw-mt-3 tw-text-lg tw-font-semibold tw-text-slate-900">This partner could not be loaded</h1>
                    <Link href="/partners/list" className="tw-mt-5 tw-inline-flex tw-items-center tw-gap-1.5 tw-text-sm tw-font-semibold tw-text-brand-700 hover:tw-text-brand-600">
                        <ArrowLeft className="tw-h-4 tw-w-4" aria-hidden /> All partners
                    </Link>
                </Card>
            </div>
        );
    }

    return (
        <div className="ui">
            <Link href="/partners/list" className="tw-mb-3 tw-inline-flex tw-items-center tw-gap-1.5 tw-text-sm tw-font-medium tw-text-slate-500 hover:tw-text-slate-900">
                <ArrowLeft className="tw-h-4 tw-w-4" aria-hidden /> All partners
            </Link>

            <div className="tw-mb-6 tw-flex tw-flex-wrap tw-items-center tw-justify-between tw-gap-4">
                <div className="tw-flex tw-min-w-0 tw-items-center tw-gap-4">
                    {loaded ? (
                        <SafeImg
                            src={details.ProfilePicture ? `${S3_URL}profile-picture/${id}/${details.ProfilePicture.fileName}` : null}
                            alt={details.fullName}
                            className="tw-h-16 tw-w-16 tw-shrink-0 tw-rounded-2xl tw-object-cover tw-ring-1 tw-ring-slate-200"
                            fallback={<Avatar name={details.fullName || '?'} seed={details.idUsers} size="lg" />}
                        />
                    ) : (
                        <Skeleton className="tw-h-16 tw-w-16 tw-rounded-2xl" />
                    )}
                    <div className="tw-min-w-0">
                        <p className="tw-text-xs tw-font-semibold tw-uppercase tw-tracking-[0.14em] tw-text-brand-700">Partner{loaded ? ` #${details.idUsers}` : ''}</p>
                        {loaded ? (
                            <h1 className="tw-mt-1 tw-text-[26px] tw-font-semibold tw-leading-8 tw-tracking-tight tw-text-slate-900">{details.fullName}</h1>
                        ) : (
                            <Skeleton className="tw-mt-2 tw-h-7 tw-w-56" />
                        )}
                        {loaded && (
                            <div className="tw-mt-2 tw-flex tw-flex-wrap tw-items-center tw-gap-2">
                                <Pill tone={TYPE_TONE[details.partnerType] ?? 'slate'} dot={false}>
                                    {words(details.partnerType)} partner
                                </Pill>
                                {details.disability === 'yes' && <Pill tone="amber" dot={false}>Disability</Pill>}
                                {details.role && <span className="tw-text-xs tw-text-slate-500">{details.role}</span>}
                            </div>
                        )}
                    </div>
                </div>
                {loaded && (
                    <LinkButton href={`/partners/edit/${details.idUsers}`}>
                        <Pencil className="tw-h-4 tw-w-4" aria-hidden /> Edit partner
                    </LinkButton>
                )}
            </div>

            {loaded && (
                <div className="tw-space-y-6">
                    <div className="tw-grid tw-grid-cols-1 tw-gap-4 lg:tw-grid-cols-3">
                        <Card className="tw-p-5 lg:tw-col-span-2">
                            <h2 className="tw-flex tw-items-center tw-gap-2 tw-text-sm tw-font-semibold tw-text-slate-900">
                                <UserRound className="tw-h-4 tw-w-4 tw-text-slate-400" aria-hidden /> Profile
                            </h2>
                            <dl className="tw-mt-4 tw-grid tw-grid-cols-1 tw-gap-x-6 tw-gap-y-4 sm:tw-grid-cols-2">
                                <Fact label="Phone">
                                    <span className="tw-tabular-nums">{details.phoneNumber}</span>
                                </Fact>
                                <Fact label="Age">{details.age ? `${details.age} years` : null}</Fact>
                                <Fact label="Location / address">{details.location}</Fact>
                                <Fact label="Joined">{details.joiningDate ? date(String(details.joiningDate)) : null}</Fact>
                                <Fact label="Education">{details.education}</Fact>
                                <Fact label="Interested in">{details.interestedIn}</Fact>
                                <Fact label="Skills" wide>
                                    {skillList.length ? (
                                        <span className="tw-flex tw-flex-wrap tw-gap-1.5">
                                            {skillList.map((skill) => (
                                                <span key={skill} className="tw-rounded-lg tw-bg-brand-50 tw-px-2 tw-py-0.5 tw-text-xs tw-font-medium tw-text-brand-800">
                                                    {skill}
                                                </span>
                                            ))}
                                        </span>
                                    ) : null}
                                </Fact>
                                <Fact label="Bio" wide>{details.bio}</Fact>
                            </dl>
                        </Card>
                        <Card className="tw-p-5">
                            <h2 className="tw-flex tw-items-center tw-gap-2 tw-text-sm tw-font-semibold tw-text-slate-900">
                                <Home className="tw-h-4 tw-w-4 tw-text-slate-400" aria-hidden /> Household
                            </h2>
                            <dl className="tw-mt-4 tw-space-y-4">
                                <Fact label="Gender">{info?.gender}</Fact>
                                <div className="tw-grid tw-grid-cols-2 tw-gap-4">
                                    <Fact label="Household size">{info?.household_size}</Fact>
                                    <Fact label="Dependents">{info?.dependents_size}</Fact>
                                </div>
                                <Fact label="Livelihood activity">{info?.livelihood_activity}</Fact>
                                <Fact label="Primary goal">{info?.primary_goal}</Fact>
                            </dl>
                        </Card>
                    </div>

                    <TableCard
                        toolbar={
                            <div>
                                <p className="tw-flex tw-items-center tw-gap-2 tw-text-sm tw-font-semibold tw-text-slate-900">
                                    <FolderKanban className="tw-h-4 tw-w-4 tw-text-slate-400" aria-hidden /> Projects with room left
                                </p>
                                <p className="tw-text-xs tw-text-slate-500">Projects still taking bookings where this partner has capacity to spare.</p>
                            </div>
                        }
                    >
                        <thead>
                            <tr>
                                <th className={TH}>Project</th>
                                <th className={cx(TH, 'tw-text-right')}>Capacity</th>
                                <th className={cx(TH, 'tw-text-right')}>Confirmed</th>
                                <th className={cx(TH, 'tw-text-right')}>Remaining</th>
                                <th className={TH}>Bookings</th>
                            </tr>
                        </thead>
                        <tbody>
                            {partnerships.length === 0 ? (
                                <EmptyRow colSpan={5} title="No open projects with room" hint="Add them to a project from Partner assignment." />
                            ) : (
                                partnerships.map((project, index) => {
                                    const bookings = (project.ProjectPartnerInvestors ?? [])
                                        .map((investor) => investor?.ProjectInvestor?.ProjectInvestmentBooking)
                                        .filter((booking) => booking?.bookingId);
                                    return (
                                        <tr key={project.Project?.idProjects ?? index} className={TR}>
                                            <td className={TD}>
                                                <div className="tw-flex tw-items-center tw-gap-3">
                                                    <SafeImg
                                                        src={project.Project?.MainImage?.fileName ? `${S3_URL}project-main-image/${project.Project.idProjects}/${project.Project.MainImage.fileName}` : null}
                                                        className="tw-h-10 tw-w-10 tw-shrink-0 tw-rounded-xl tw-object-cover tw-ring-1 tw-ring-slate-200"
                                                        fallback={
                                                            <span className="tw-flex tw-h-10 tw-w-10 tw-shrink-0 tw-items-center tw-justify-center tw-rounded-xl tw-bg-slate-100 tw-text-slate-400">
                                                                <FolderKanban className="tw-h-4 tw-w-4" aria-hidden />
                                                            </span>
                                                        }
                                                    />
                                                    <div className="tw-min-w-0">
                                                        <Link href={`/projects/details/${project.Project?.idProjects}`} className="tw-font-medium tw-text-slate-900 hover:tw-text-brand-700">
                                                            {project.Project?.projectName}
                                                        </Link>
                                                        <div className="tw-text-xs tw-text-slate-500">{project.Project?.location}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className={cx(TD, 'tw-text-right tw-tabular-nums')}>{project.partnerUnitCapacity}</td>
                                            <td className={cx(TD, 'tw-text-right tw-tabular-nums')}>{project.alreadyInvestedUnits}</td>
                                            <td className={cx(TD, 'tw-text-right tw-tabular-nums')}>{Number(project.partnerUnitCapacity) - Number(project.alreadyInvestedUnits || 0)}</td>
                                            <td className={TD}>
                                                <div className="tw-flex tw-flex-wrap tw-gap-1">
                                                    {bookings.length === 0 ? (
                                                        <span className="tw-text-xs tw-text-slate-400">None</span>
                                                    ) : (
                                                        bookings.map((booking) => (
                                                            <Link
                                                                key={booking!.idProjectInvestmentBookings}
                                                                href={`/bookings/details/${booking!.idProjectInvestmentBookings}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="tw-inline-flex tw-items-center tw-gap-0.5 tw-rounded-md tw-bg-slate-100 tw-px-1.5 tw-py-0.5 tw-text-xs tw-font-medium tw-tabular-nums tw-text-slate-700 hover:tw-bg-brand-50 hover:tw-text-brand-700"
                                                            >
                                                                {booking!.bookingId}
                                                                <ArrowUpRight className="tw-h-3 tw-w-3" aria-hidden />
                                                            </Link>
                                                        ))
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </TableCard>

                    <Card className="tw-p-5">
                        <h2 className="tw-text-sm tw-font-semibold tw-text-slate-900">Featured images</h2>
                        {images.length === 0 ? (
                            <div className="tw-flex tw-flex-col tw-items-center tw-gap-2 tw-py-8 tw-text-sm tw-text-slate-500">
                                <ImageOff className="tw-h-6 tw-w-6 tw-text-slate-400" aria-hidden />
                                No featured images. Add them from Edit partner.
                            </div>
                        ) : (
                            <ul className="tw-mt-4 tw-grid tw-grid-cols-2 tw-gap-3 sm:tw-grid-cols-3 lg:tw-grid-cols-4">
                                {images.map((image) => {
                                    const url = `${S3_URL}featured-image/${id}/${image.fileName}`;
                                    return (
                                        <li key={image.idFiles}>
                                            <a href={url} target="_blank" rel="noopener noreferrer" className="tw-group tw-block tw-overflow-hidden tw-rounded-xl tw-border tw-border-slate-200 tw-bg-slate-50">
                                                <SafeImg
                                                    src={url}
                                                    alt={image.originalFileName}
                                                    className="tw-aspect-[4/3] tw-w-full tw-object-cover tw-transition group-hover:tw-scale-[1.02]"
                                                    fallback={
                                                        <span className="tw-flex tw-aspect-[4/3] tw-w-full tw-items-center tw-justify-center tw-text-slate-300">
                                                            <ImageOff className="tw-h-6 tw-w-6" aria-hidden />
                                                        </span>
                                                    }
                                                />
                                            </a>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </Card>
                </div>
            )}
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
