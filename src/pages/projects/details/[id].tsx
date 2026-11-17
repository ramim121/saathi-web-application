/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect } from "react";
import Link from "next/link";
import MainLayout from "@/layouts/MainLayout";
import { useRouter } from "next/router";
import { getRequestOptions, postRequestOptions } from "@/utils/Fetch";
import Swal from "sweetalert2";
import { S3_URL } from '@/config/public';
import { API_URL } from '@/config/public';
import { GetServerSidePropsContext } from "next";
import ProjectType from "@/types/Project";
import { getProjectDetails } from "@/pages/api/projects/details/[id]";
import { requireAdminPage, redirectToLogin } from "@/utils/pageAuth";
import { ArrowLeft, ArrowUpRight, CalendarRange, CheckCircle2, FolderKanban, ImageOff, Layers, MapPin, Pencil, Percent, Timer, UserRound, Wallet, type LucideIcon } from "lucide-react";
import { Avatar, Card, Pill, SafeImg, Segmented, cx } from "@/ui/primitives";
import { Button, LinkButton } from "@/ui/controls";
import { EmptyRow, TableCard, TD, TH, TR } from "@/ui/layout";
import { bdt, bdtExact, date, plural } from "@/ui/format";
import { investmentStatus, paymentStatus, projectStatus, returnRange, words } from "@/ui/status";

/** What the loader adds to the model: confirmed units, and what is left (null = no unit cap). */
type ProjectData = ProjectType & { totalInvestedUnits?: number; totalRemainingUnits?: number | null };

interface ProjectDetailsProps {
    projectDataMain: ProjectData
}

type Tab = 'overview' | 'investors' | 'partners' | 'images';

function Fact({ icon: Icon, label, value, hint }: { icon: LucideIcon; label: string; value: React.ReactNode; hint?: React.ReactNode }) {
    return (
        <div className="tw-bg-white tw-px-4 tw-py-3">
            <dt className="tw-flex tw-items-center tw-gap-1.5 tw-text-xs tw-font-medium tw-text-slate-500">
                <Icon className="tw-h-3.5 tw-w-3.5 tw-text-slate-400" aria-hidden />
                {label}
            </dt>
            <dd className="tw-mt-1 tw-text-sm tw-font-semibold tw-tabular-nums tw-text-slate-900">{value}</dd>
            {hint && <dd className="tw-text-xs tw-text-slate-500">{hint}</dd>}
        </div>
    );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="tw-flex tw-items-baseline tw-justify-between tw-gap-4 tw-py-2">
            <dt className="tw-shrink-0 tw-text-sm tw-text-slate-500">{label}</dt>
            <dd className="tw-min-w-0 tw-break-words tw-text-right tw-text-sm tw-font-medium tw-text-slate-900">{children}</dd>
        </div>
    );
}

const Details = ({ projectDataMain }: ProjectDetailsProps) => {

    const [projectData, setProjectData] = useState<ProjectData>(projectDataMain);
    const router = useRouter();
    const { id } = router.query;
    const [reload, setReload] = useState<boolean>(false);
    const [tab, setTab] = useState<Tab>('overview');

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

    const status = projectStatus(projectData.projectStatus);
    const investors = projectData.ProjectInvestors ?? [];
    const partners = projectData.ProjectPartners ?? [];
    const images = projectData.FeaturedImages ?? [];
    const invested = Number(projectData.totalInvestedUnits ?? 0);
    const available = Number(projectData.totalAvailableUnits || 0);
    const mainImageUrl = projectData.MainImage ? `${S3_URL}project-main-image/${projectData.idProjects}/${projectData.MainImage.fileName}` : null;
    const special = projectData.ProjectProperty;

    return (
        <div className="ui">
            <Link href="/projects/list" className="tw-mb-3 tw-inline-flex tw-items-center tw-gap-1.5 tw-text-sm tw-font-medium tw-text-slate-500 hover:tw-text-slate-900">
                <ArrowLeft className="tw-h-4 tw-w-4" aria-hidden /> All projects
            </Link>

            <div className="tw-mb-6 tw-flex tw-flex-wrap tw-items-start tw-justify-between tw-gap-4">
                <div className="tw-min-w-0">
                    <p className="tw-text-xs tw-font-semibold tw-uppercase tw-tracking-[0.14em] tw-text-brand-700">Project #{projectData.idProjects}</p>
                    <h1 className="tw-mt-1 tw-text-[26px] tw-font-semibold tw-leading-8 tw-tracking-tight tw-text-slate-900">{projectData.projectName}</h1>
                    {projectData.projectNameBn && (
                        <p lang="bn" className="tw-mt-0.5 tw-text-sm tw-text-slate-500">
                            {projectData.projectNameBn}
                        </p>
                    )}
                    <div className="tw-mt-2 tw-flex tw-flex-wrap tw-items-center tw-gap-2">
                        <Pill tone={status.tone}>{status.label}</Pill>
                        {projectData.projectType === 'special' && <Pill tone="violet">Special project</Pill>}
                        {projectData.showInUpcoming === 'yes' && <Pill tone="sky">Shown as upcoming</Pill>}
                        <span className="tw-text-xs tw-text-slate-500">
                            {[projectData.ProjectCategory?.categoryName, words(projectData.investmentType), projectData.CreatedBy?.fullName ? `created by ${projectData.CreatedBy.fullName}` : null]
                                .filter(Boolean)
                                .join(' · ')}
                        </span>
                    </div>
                </div>
                <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-2">
                    <LinkButton href={`/projects/edit/${projectData.idProjects}`}>
                        <Pencil className="tw-h-4 tw-w-4" aria-hidden /> Edit project
                    </LinkButton>
                    {projectData.projectStatus === 'created' && (
                        <Button variant="primary" onClick={() => projectStatusChange('completed')}>
                            <CheckCircle2 className="tw-h-4 tw-w-4" aria-hidden /> Mark complete
                        </Button>
                    )}
                </div>
            </div>

            <div className="tw-grid tw-grid-cols-1 tw-gap-4 lg:tw-grid-cols-3">
                <Card className="tw-overflow-hidden">
                    <SafeImg
                        src={mainImageUrl}
                        alt={projectData.MainImage?.originalFileName || projectData.projectName}
                        className="tw-aspect-[4/3] tw-w-full tw-bg-slate-100 tw-object-cover"
                        fallback={
                            <div className="tw-flex tw-aspect-[4/3] tw-w-full tw-flex-col tw-items-center tw-justify-center tw-gap-2 tw-bg-slate-50 tw-text-sm tw-text-slate-400">
                                <FolderKanban className="tw-h-8 tw-w-8" aria-hidden />
                                {projectData.MainImage ? 'Image unavailable' : 'No main image'}
                            </div>
                        }
                    />
                </Card>
                <Card className="tw-overflow-hidden lg:tw-col-span-2">
                    <dl className="tw-grid tw-grid-cols-2 tw-gap-px tw-bg-slate-100 sm:tw-grid-cols-3">
                        <Fact icon={Wallet} label="Unit price" value={bdtExact(Number(projectData.unitInvestmentValue))} hint={words(projectData.returnType) + ' return'} />
                        <Fact icon={Percent} label="Return" value={returnRange(projectData.returnRangeMin, projectData.returnRangeMax)} hint={`${bdt(Number(projectData.totalReturnMin))} – ${bdt(Number(projectData.totalReturnMax))} back per unit`} />
                        <Fact icon={Timer} label="Term" value={`${projectData.duration} ${projectData.tenure}`} />
                        <Fact
                            icon={Layers}
                            label="Units confirmed"
                            value={available ? `${invested} of ${available}` : invested}
                            hint={available ? `${Number(projectData.totalRemainingUnits ?? 0)} left` : 'No unit cap'}
                        />
                        <Fact icon={UserRound} label="Per-investor cap" value={Number(projectData.investorUnitCapacity) > 0 ? plural(Number(projectData.investorUnitCapacity), 'unit') : 'No limit'} />
                        <Fact
                            icon={CalendarRange}
                            label="Collection"
                            value={projectData.collectionStarts ? date(projectData.collectionStarts) : '—'}
                            hint={projectData.collectionEnds ? `until ${date(projectData.collectionEnds)}` : undefined}
                        />
                    </dl>
                    <div className="tw-flex tw-items-start tw-gap-2 tw-border-t tw-border-slate-100 tw-px-4 tw-py-3 tw-text-sm">
                        <MapPin className="tw-mt-0.5 tw-h-4 tw-w-4 tw-shrink-0 tw-text-slate-400" aria-hidden />
                        <div className="tw-min-w-0">
                            <p className="tw-text-slate-800">{projectData.location || '—'}</p>
                            {projectData.otherLocations && <p className="tw-text-xs tw-text-slate-500">Also: {projectData.otherLocations}</p>}
                        </div>
                    </div>
                </Card>
            </div>

            <div className="tw-mb-5 tw-mt-6">
                <Segmented<Tab>
                    label="Project sections"
                    value={tab}
                    onChange={setTab}
                    options={[
                        { value: 'overview', label: 'Overview' },
                        { value: 'investors', label: 'Investors', count: investors.length },
                        { value: 'partners', label: 'Partners', count: partners.length },
                        { value: 'images', label: 'Images', count: images.length },
                    ]}
                />
            </div>

            {tab === 'overview' && (
                <div className="tw-grid tw-grid-cols-1 tw-gap-4 lg:tw-grid-cols-3">
                    <Card className="tw-p-5 lg:tw-col-span-2">
                        <h2 className="tw-text-sm tw-font-semibold tw-text-slate-900">Summary</h2>
                        {projectData.summary ? (
                            <div className="ui-prose tw-mt-3" dangerouslySetInnerHTML={{ __html: projectData.summary || "" }} />
                        ) : (
                            <p className="tw-mt-2 tw-text-sm tw-text-slate-400">No summary written.</p>
                        )}
                        {projectData.summaryBn && (
                            <>
                                <h2 className="tw-mt-6 tw-border-t tw-border-slate-100 tw-pt-4 tw-text-sm tw-font-semibold tw-text-slate-900">Summary (বাংলা)</h2>
                                <div lang="bn" className="ui-prose tw-mt-3" dangerouslySetInnerHTML={{ __html: projectData.summaryBn }} />
                            </>
                        )}
                    </Card>
                    <div className="tw-space-y-4">
                        <Card className="tw-p-5">
                            <h2 className="tw-text-sm tw-font-semibold tw-text-slate-900">Setup</h2>
                            <dl className="tw-mt-2 tw-divide-y tw-divide-slate-100">
                                <Row label="Category">{projectData.ProjectCategory?.categoryName || '—'}</Row>
                                <Row label="Investment type">{words(projectData.investmentType)}</Row>
                                <Row label="Return type">{words(projectData.returnType)}</Row>
                                <Row label="Project type">{words(projectData.projectType)}</Row>
                                <Row label="Upcoming list">{projectData.showInUpcoming === 'yes' ? 'Shown' : 'Hidden'}</Row>
                                <Row label="Created by">{projectData.CreatedBy?.fullName || '—'}</Row>
                            </dl>
                        </Card>
                        {projectData.projectType == "special" && (
                            <Card className="tw-p-5">
                                <h2 className="tw-text-sm tw-font-semibold tw-text-slate-900">Special project property</h2>
                                <dl className="tw-mt-2 tw-divide-y tw-divide-slate-100">
                                    <Row label="Live weight rate">{special?.cattleLiveWeightRate ?? '—'}</Row>
                                    <Row label="Initial weight">
                                        {special?.cattleInitialWeightMin ?? '—'} – {special?.cattleInitialWeightMax ?? '—'}
                                    </Row>
                                    <Row label="Final weight">
                                        {special?.cattleFinalWeightMin ?? '—'} – {special?.cattleFinalWeightMax ?? '—'}
                                    </Row>
                                </dl>
                            </Card>
                        )}
                    </div>
                </div>
            )}

            {tab === 'investors' && (
                <TableCard
                    toolbar={
                        <p className="tw-text-xs tw-text-slate-500">
                            {plural(investors.length, 'investment line')} · {plural(invested, 'unit')} confirmed
                        </p>
                    }
                >
                    <thead>
                        <tr>
                            <th className={TH}>Booking</th>
                            <th className={TH}>Investor</th>
                            <th className={TH}>Payment</th>
                            <th className={TH}>Investment</th>
                            <th className={cx(TH, 'tw-text-right')}>Units</th>
                            <th className={cx(TH, 'tw-text-right')}>Amount</th>
                            <th className={TH}>Partners</th>
                        </tr>
                    </thead>
                    <tbody>
                        {investors.length > 0 ? (
                            investors.map((investor) => {
                                const booking = investor.ProjectInvestmentBooking;
                                const pay = paymentStatus(booking?.paymentConfirmationStatus, booking?.cancelled);
                                const line = investmentStatus(investor.investmentStatus);
                                const allocations = investor.ProjectPartnerInvestors ?? [];
                                const amount = allocations.reduce((sum, p) => sum + Number(p.amountInvested || 0), 0);
                                return (
                                    <tr key={investor.idProjectInvestors} className={TR}>
                                        <td className={cx(TD, 'tw-whitespace-nowrap')}>
                                            {booking ? (
                                                <Link
                                                    href={"/bookings/details/" + booking.idProjectInvestmentBookings}
                                                    className="tw-group tw-inline-flex tw-items-center tw-gap-1 tw-font-medium tw-tabular-nums tw-text-slate-900 hover:tw-text-brand-700"
                                                >
                                                    #{booking.bookingId || booking.idProjectInvestmentBookings}
                                                    <ArrowUpRight className="tw-h-3.5 tw-w-3.5 tw-text-slate-400 group-hover:tw-text-brand-700" aria-hidden />
                                                </Link>
                                            ) : (
                                                '—'
                                            )}
                                            <div className="tw-text-xs tw-tabular-nums tw-text-slate-400">line {investor.idProjectInvestors}</div>
                                        </td>
                                        <td className={TD}>
                                            <div className="tw-flex tw-items-center tw-gap-2.5">
                                                <SafeImg
                                                    src={investor.User?.profileImage ? `${S3_URL}profile/${investor.User.profileImage}` : null}
                                                    className="tw-h-8 tw-w-8 tw-shrink-0 tw-rounded-full tw-object-cover tw-ring-1 tw-ring-slate-200"
                                                    fallback={<Avatar name={investor.User?.fullName || '?'} seed={investor.User?.idUsers || 0} size="sm" />}
                                                />
                                                <div className="tw-min-w-0">
                                                    <div className="tw-font-medium tw-text-slate-900">{investor.User?.fullName || '—'}</div>
                                                    <div className="tw-text-xs tw-tabular-nums tw-text-slate-500">{investor.User?.phoneNumber || '—'}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className={TD}><Pill tone={pay.tone}>{pay.label}</Pill></td>
                                        <td className={TD}><Pill tone={line.tone}>{line.label}</Pill></td>
                                        <td className={cx(TD, 'tw-text-right tw-tabular-nums')}>{investor.unitPurchased}</td>
                                        <td className={cx(TD, 'tw-whitespace-nowrap tw-text-right tw-tabular-nums tw-text-slate-900')}>{bdt(amount)}</td>
                                        <td className={TD}>
                                            <ul className="tw-space-y-0.5 tw-text-xs tw-text-slate-600">
                                                {allocations.map((allocation, index) => (
                                                    <li key={index} className="tw-whitespace-nowrap">
                                                        {allocation.ProjectPartner?.User?.fullName || '—'}
                                                        <span className="tw-tabular-nums tw-text-slate-400">
                                                            {' '}× {allocation.investedUnit} · {bdt(Number(allocation.amountInvested))}
                                                        </span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </td>
                                    </tr>
                                );
                            })
                        ) : (
                            <EmptyRow colSpan={7} title="No investors yet" hint="Bookings on this project will appear here." />
                        )}
                    </tbody>
                </TableCard>
            )}

            {tab === 'partners' && (
                <TableCard>
                    <thead>
                        <tr>
                            <th className={TH}>Partner</th>
                            <th className={TH}>Joined</th>
                            <th className={cx(TH, 'tw-text-right')}>Capacity</th>
                            <th className={cx(TH, 'tw-text-right')}>Confirmed units</th>
                            <th className={cx(TH, 'tw-text-right')}>Remaining</th>
                        </tr>
                    </thead>
                    <tbody>
                        {partners.length > 0 ? (
                            partners.map((partner) => {
                                const capacity = Number(partner.partnerUnitCapacity || 0);
                                const used = Number(partner.alreadyInvestedUnits ?? 0);
                                return (
                                    <tr key={partner.idProjectPartners} className={TR}>
                                        <td className={TD}>
                                            <div className="tw-flex tw-items-center tw-gap-2.5">
                                                <SafeImg
                                                    src={partner.User?.ProfilePicture?.fileName ? `${S3_URL}profile-picture/${partner.idUsers}/${partner.User.ProfilePicture.fileName}` : null}
                                                    className="tw-h-8 tw-w-8 tw-shrink-0 tw-rounded-full tw-object-cover tw-ring-1 tw-ring-slate-200"
                                                    fallback={<Avatar name={partner.User?.fullName || '?'} seed={partner.idUsers || 0} size="sm" />}
                                                />
                                                <div className="tw-min-w-0">
                                                    <Link href={`/partners/details/${partner.idUsers}`} className="tw-font-medium tw-text-slate-900 hover:tw-text-brand-700">
                                                        {partner.User?.fullName || '—'}
                                                    </Link>
                                                    <div className="tw-text-xs tw-tabular-nums tw-text-slate-500">{partner.User?.phoneNumber || '—'}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className={cx(TD, 'tw-whitespace-nowrap tw-tabular-nums tw-text-slate-600')}>{partner.User?.joiningDate ? date(String(partner.User.joiningDate)) : '—'}</td>
                                        <td className={cx(TD, 'tw-text-right tw-tabular-nums')}>{capacity > 0 ? capacity : <span className="tw-text-slate-400">No limit</span>}</td>
                                        <td className={cx(TD, 'tw-text-right tw-tabular-nums')}>{used}</td>
                                        <td className={cx(TD, 'tw-text-right tw-tabular-nums')}>
                                            {capacity > 0 ? (
                                                <span className={cx(capacity - used <= 0 && 'tw-font-medium tw-text-amber-700')}>{capacity - used}</span>
                                            ) : (
                                                <span className="tw-text-slate-400">—</span>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })
                        ) : (
                            <EmptyRow colSpan={5} title="No partners assigned" hint="Assign partners from Assign projects." />
                        )}
                    </tbody>
                </TableCard>
            )}

            {tab === 'images' && (
                <Card className="tw-p-5">
                    {images.length === 0 ? (
                        <div className="tw-flex tw-flex-col tw-items-center tw-gap-2 tw-py-10 tw-text-sm tw-text-slate-500">
                            <ImageOff className="tw-h-6 tw-w-6 tw-text-slate-400" aria-hidden />
                            No featured images. Add them from Edit project.
                        </div>
                    ) : (
                        <ul className="tw-grid tw-grid-cols-2 tw-gap-3 sm:tw-grid-cols-3 lg:tw-grid-cols-4">
                            {images.map((image, index) => {
                                const url = `${S3_URL}project-featured-image/${projectData.idProjects}/${image.fileName}`;
                                return (
                                    <li key={image.idFiles ?? index}>
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
                                            <span className="tw-block tw-truncate tw-border-t tw-border-slate-200 tw-bg-white tw-px-2.5 tw-py-1.5 tw-text-xs tw-text-slate-600">{image.originalFileName}</span>
                                        </a>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </Card>
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

export async function getServerSideProps(context: GetServerSidePropsContext) {
    /*
     * SECURITY: this page had no sign-in check. It is rendered on the server,
     * so anyone who opened /projects/details/<id> got the page — and with it,
     * in the page data, the user record of every investor and partner on the
     * project (phone, email, date of birth, Google/Apple ids, NID fields).
     */
    const auth = requireAdminPage(context);
    if (!auth) return redirectToLogin;

    const projectId = context.params?.id;

    const projectData = await getProjectDetails(projectId as string);

    // A deleted or mistyped id returns null, and the component reads
    // projectData.projectName unconditionally — which crashed the render and
    // served a 500 instead of a not-found page.
    if (!projectData) return { notFound: true };

    return {
        props: {
            projectDataMain: JSON.parse(JSON.stringify(projectData))
        }
    }
}
