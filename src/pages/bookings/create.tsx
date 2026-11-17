import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import MainLayout from "@/layouts/MainLayout";
import { Modal } from "react-bootstrap";
import { API_URL } from '@/config/public';
import ReactSelect, { SingleValue } from "react-select";
import Swal from "sweetalert2";
import { getRequestOptions, postRequestOptions } from "@/utils/Fetch";
import { CalendarDays, FolderPlus, Layers, Loader2, MapPin, Plus, ShieldAlert, Trash2, UserRound, Wallet, X } from "lucide-react";
import { Avatar, Card } from "@/ui/primitives";
import { Button, Field, Input, Required, Select } from "@/ui/controls";
import { PageHeader } from "@/ui/layout";
import { selectStyles } from "@/ui/select";
import { bdt, bdtExact, date, plural } from "@/ui/format";


interface InvestorType {
    idUsers: number;
    fullName: string;
    label: string;
    value: number;
    phoneNumber: string;
}


interface ProjectPartnerType {
    idProjectPartners: number;
    partnerUnitCapacity: number;
    User: {
        idUsers: number;
        fullName: string;
        phoneNumber: string;
    };
    investedUnit: number;
    amountInvested: number;
    /** Shown in the partner picker only; never sent. */
    investorConfirmedBookingCount?: number;
    investorAlreadyBookedCount?: number;
}

interface ProjectCategoryType {
    idProjectCategories: number;
    categoryName: string;
}

interface ProjectDataType {
    idProjects: number;
    location: string;
    duration: string;
    tenure: string;
    investmentType: string;
    projectName: string;
    projectStatus: string;
    projectType: string;
    returnRangeMin: number;
    returnRangeMax: number;
    unitInvestmentValue: number;
    totalAvailableUnits: number;
    totalInvestedUnits: number;
    totalRemainingUnits: number;
    label: string;
    value: number;
    ProjectCategory: ProjectCategoryType;
}

interface FormProjectType {
    idProjects: number | null;
    unitPurchased: number;
    project: ProjectDataType | null;
    projectPartners: {
        idProjectPartners: number;
        investedUnit: number;
        amountInvested: number;
        User: {
            idUsers: number;
            fullName: string;
            phoneNumber: string;
        };
    }[];
}

interface FormDataType {
    investmentDate: string;
    investor: InvestorType;
    projects: FormProjectType[];
}

/** Capital plus the project's projected return, low and high. */
function expectedBack(amount: number, project: ProjectDataType | null) {
    return {
        min: amount + (amount * Number(project?.returnRangeMin || 0)) / 100,
        max: amount + (amount * Number(project?.returnRangeMax || 0)) / 100,
    };
}

function Create() {
    const router = useRouter();
    const [formData, setFormData] = useState<FormDataType>({
        investmentDate: "",
        investor: {
            idUsers: 0,
            fullName: "",
            label: "",
            value: 0,
            phoneNumber: "",
        },
        projects: [],
    });
    const [loading, setLoading] = useState<boolean>(false);
    const [investors, setInvestors] = useState<InvestorType[]>([]);
    const [projects, setProjects] = useState<ProjectDataType[]>([]);
    const [projectPartners, setProjectPartners] = useState<ProjectPartnerType[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [modalProject, setModalProject] = useState<{
        project: ProjectDataType | null;
        projectPartners: ProjectPartnerType[] | [];
    }>({ project: null, projectPartners: [] });

    useEffect(() => {
        fetchInvestors();
        fetchProjectsForInvestment();
    }, []);

    useEffect(() => {
        if (modalProject.project) {
            fetchProjectPartners(modalProject.project.idProjects);
        }
    }, [modalProject.project]);

    const fetchInvestors = async () => {
        try {
            // Sends the admin token: `user/investors` returns the investor list
            // and was locked to admin, so a tokenless call now 401s and this
            // page showed "Authentication required" instead of the dropdown.
            const res = await fetch(API_URL + "api/user/investors", getRequestOptions());
            const data = await res.json();
            if (res.status === 200) {
                setInvestors(data.data);
            } else {
                Swal.fire({ icon: "error", title: "Error", text: data.message });
            }
        } catch {
            Swal.fire({ icon: "error", title: "Error", text: "Something went wrong!" });
        }
    };

    const fetchProjectsForInvestment = async () => {
        try {
            const res = await fetch(API_URL + "api/projects/get_projects_for_investment");
            const data = await res.json();
            if (res.status === 200) {
                setProjects(
                    data.data.map((project: any) => ({
                        idProjects: project.idProjects,
                        location: project.location,
                        duration: project.duration,
                        tenure: project.tenure,
                        investmentType: project.investmentType,
                        projectName: project.projectName,
                        projectStatus: project.projectStatus,
                        projectType: project.projectType,
                        returnRangeMin: project.returnRangeMin,
                        returnRangeMax: project.returnRangeMax,
                        unitInvestmentValue: project.unitInvestmentValue,
                        totalAvailableUnits: project.totalAvailableUnits,
                        totalInvestedUnits: project.totalInvestedUnits,
                        totalRemainingUnits: project.totalRemainingUnits,
                        label: project.projectName,
                        value: project.idProjects,
                        ProjectCategory: project.ProjectCategory,
                    }))
                );
            } else {
                Swal.fire({ icon: "error", title: "Error", text: data.message });
            }
        } catch {
            Swal.fire({ icon: "error", title: "Error", text: "Something went wrong!" });
        }
    };

    const fetchProjectPartners = async (projectId: number) => {
        try {
            // Now sends the admin token. The route is still open, but
            // SECURITY-REMEDIATION.md names this call (it sent none) as the one
            // thing stopping it from being locked to admins.
            const res = await fetch(`${API_URL}api/projects/project-partners/${projectId}`, getRequestOptions());
            const data = await res.json();
            if (res.status === 200) {
                setProjectPartners(
                    data.data.map((partner: any) => ({
                        idProjectPartners: partner.idProjectPartners,
                        partnerUnitCapacity: partner.partnerUnitCapacity,
                        User: {
                            idUsers: partner.User.idUsers,
                            fullName: partner.User.fullName,
                            phoneNumber: partner.User.phoneNumber,
                        },
                        investorConfirmedBookingCount: partner.investorConfirmedBookingCount,
                        investorAlreadyBookedCount: partner.investorAlreadyBookedCount,
                        label: `${partner.User.fullName} (${partner.partnerUnitCapacity})`,
                        value: partner.idProjectPartners
                    }))
                );
            } else {
                Swal.fire({ icon: "error", title: "Error", text: data.message });
            }
        }
        catch {
            Swal.fire({ icon: "error", title: "Error", text: "Something went wrong!" });
        }
    };

    const handleOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleOpenModal = () => {
        setShowModal(true);
        setModalProject({ project: null, projectPartners: [] });
    };

    const handleAddProject = () => {
        if (!modalProject.project || modalProject.projectPartners.length === 0) {
            Swal.fire({
                icon: "warning",
                title: "Select a project and at least one partner.",
            });
            return;
        }
        const existingProject = formData.projects.find(
            (p) => p.idProjects === modalProject.project?.idProjects
        );
        if (existingProject) {
            Swal.fire({
                icon: "warning",
                title: "Project already added.",
                text: "Please select a different project.",
            });
            return;
        }
        const newProject: FormProjectType = {
            idProjects: modalProject.project.idProjects,
            unitPurchased: modalProject.projectPartners.reduce(
                (sum, pp) => sum + (pp.investedUnit || 0),
                0
            ),
            project: modalProject.project,
            projectPartners: modalProject.projectPartners.map((pp) => ({
                idProjectPartners: pp.idProjectPartners,
                investedUnit: pp.investedUnit,
                amountInvested: pp.amountInvested,
                User: {
                    idUsers: pp.User.idUsers,
                    fullName: pp.User.fullName,
                    phoneNumber: pp.User.phoneNumber,
                },
            })),
        };
        setFormData((prev) => ({
            ...prev,
            projects: [...prev.projects, newProject],
        }));
        setShowModal(false);
        setModalProject({ project: null, projectPartners: [] });
    };

    const handleRemoveProject = (index: number) => {
        setFormData((prev) => {
            const updatedProjects = [...prev.projects];
            updatedProjects.splice(index, 1);
            return { ...prev, projects: updatedProjects };
        });

    }

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!formData.investmentDate || !formData.investor.idUsers || formData.projects.length === 0) {
            Swal.fire({
                icon: "warning",
                title: "Please fill all required fields.",
            });
            return;
        }
        setLoading(true);
        try {
            const res = await fetch(API_URL + "api/bookings/manual_booking", postRequestOptions(formData));
            const data = await res.json();
            if (res.status === 200) {
                const created = data.data ?? {};
                Swal.fire({
                    icon: "success",
                    title: "Booking created successfully!",
                    text: `Booking ID: ${created.bookingId}`,
                    showCancelButton: Boolean(created.idProjectInvestmentBookings),
                    confirmButtonText: created.idProjectInvestmentBookings ? "Open booking" : "OK",
                    cancelButtonText: "Create another",
                }).then((result) => {
                    if (result.isConfirmed && created.idProjectInvestmentBookings) {
                        router.push(`/bookings/details/${created.idProjectInvestmentBookings}`);
                    }
                });
                setFormData({
                    investmentDate: "",
                    investor: {
                        idUsers: 0,
                        fullName: "",
                        label: "",
                        value: 0,
                        phoneNumber: "",
                    },
                    projects: [],
                });
            } else {
                Swal.fire({ icon: "error", title: "Error", text: data.message });
            }
        } catch (error) {
            Swal.fire({ icon: "error", title: "Error", text: "Something went wrong!" });
        } finally {
            setLoading(false);
        }
    };

    const addPartnerRow = () => {
        // Add a new empty partner row
        setModalProject((prev) => ({
            ...prev,
            projectPartners: [
                ...prev.projectPartners,
                {
                    idProjectPartners: 0,
                    partnerUnitCapacity: 0,
                    User: { idUsers: 0, fullName: "", phoneNumber: "" },
                    investedUnit: 0,
                    amountInvested: 0

                } as any,
            ],
        }));
    };

    const selectPartner = (idx: number, idProjectPartners: number) => {
        const selected = projectPartners.find((p) => p.idProjectPartners === idProjectPartners) || null;
        setModalProject((prev) => {
            const updated = [...prev.projectPartners];
            updated[idx] = {
                ...updated[idx],
                ...(selected || {
                    idProjectPartners: 0,
                    partnerUnitCapacity: 0,
                    User: { idUsers: 0, fullName: "", phoneNumber: "" },
                }),
            };
            return { ...prev, projectPartners: updated };
        });
    };

    const setPartnerUnits = (idx: number, value: string) => {
        let units = Number(value);
        setModalProject((prev) => {
            const updated = [...prev.projectPartners];
            updated[idx] = { ...updated[idx], investedUnit: units, amountInvested: units * (modalProject.project?.unitInvestmentValue || 0) };
            return { ...prev, projectPartners: updated };
        });
    };

    const removePartnerRow = (idx: number) => {
        setModalProject((prev) => ({
            ...prev,
            projectPartners: prev.projectPartners.filter((_, i) => i !== idx),
        }));
    };

    /* ------------------------------------------------------------ derived */

    const bookingUnits = formData.projects.reduce((sum, project) => sum + (Number(project.unitPurchased) || 0), 0);
    const projectAmount = (project: FormProjectType) => project.projectPartners.reduce((sum, pp) => sum + (pp.amountInvested || 0), 0);
    const bookingTotal = formData.projects.reduce((sum, project) => sum + projectAmount(project), 0);
    const bookingBack = formData.projects.reduce(
        (acc, project) => {
            const back = expectedBack(projectAmount(project), project.project);
            return { min: acc.min + back.min, max: acc.max + back.max };
        },
        { min: 0, max: 0 }
    );

    const unitValue = modalProject.project?.unitInvestmentValue || 0;
    const modalUnits = modalProject.projectPartners.reduce((sum, pp) => sum + (Number(pp.investedUnit) || 0), 0);
    const modalAmount = modalProject.projectPartners.reduce((sum, pp) => sum + unitValue * (Number(pp.investedUnit) || 0), 0);
    const modalBack = expectedBack(modalAmount, modalProject.project);
    const remainingUnits = modalProject.project ? Number(modalProject.project.totalRemainingUnits) : null;

    const investorOptions: InvestorType[] = investors.map((inv) => ({
        idUsers: inv.idUsers,
        fullName: inv.fullName,
        // Investors who signed up by email have no phone; they read "Name (null)".
        label: inv.phoneNumber ? `${inv.fullName} (${inv.phoneNumber})` : inv.fullName,
        value: inv.idUsers,
        phoneNumber: inv.phoneNumber,
    }));

    return (
        <div className="ui">
            <PageHeader
                eyebrow="Bookings"
                title="New booking"
                description="Record a booking on an investor's behalf, for money taken outside the app. It starts as awaiting payment, like any other booking."
            />

            <form onSubmit={handleSubmit} className="tw-grid tw-grid-cols-1 tw-items-start tw-gap-6 lg:tw-grid-cols-3">
                <div className="tw-space-y-6 lg:tw-col-span-2">
                    <Card className="tw-p-5">
                        <h2 className="tw-flex tw-items-center tw-gap-2 tw-text-sm tw-font-semibold tw-text-slate-900">
                            <UserRound className="tw-h-4 tw-w-4 tw-text-slate-400" aria-hidden /> Investor and date
                        </h2>
                        <div className="tw-mt-4 tw-grid tw-grid-cols-1 tw-gap-4 sm:tw-grid-cols-3">
                            <Field label={<>Investor<Required /></>} hint="Search by name or phone number." className="sm:tw-col-span-2">
                                <ReactSelect<InvestorType>
                                    instanceId="investor"
                                    inputId="investor"
                                    options={investorOptions}
                                    name="investor"
                                    isSearchable
                                    isClearable
                                    placeholder="Select investor"
                                    styles={selectStyles<InvestorType>()}
                                    noOptionsMessage={() => (investors.length ? "No investor matches" : "Loading investors…")}
                                    onChange={(e: SingleValue<InvestorType>) =>
                                        setFormData({
                                            ...formData,
                                            investor: e
                                                ? {
                                                    idUsers: e.idUsers,
                                                    fullName: e.fullName,
                                                    label: e.label,
                                                    value: e.value,
                                                    phoneNumber: e.phoneNumber,
                                                }
                                                : {
                                                    idUsers: 0,
                                                    fullName: "",
                                                    label: "",
                                                    value: 0,
                                                    phoneNumber: "",
                                                },
                                        })
                                    }
                                    value={formData.investor.idUsers ? formData.investor : null}
                                />
                            </Field>
                            <Field label={<>Investment date<Required /></>} hint="Units start earning from this date.">
                                <Input type="date" name="investmentDate" onChange={handleOnChange} value={formData.investmentDate} />
                            </Field>
                        </div>
                    </Card>

                    <Card>
                        <div className="tw-flex tw-flex-wrap tw-items-center tw-justify-between tw-gap-3 tw-border-b tw-border-slate-100 tw-px-5 tw-py-3">
                            <h2 className="tw-flex tw-items-center tw-gap-2 tw-text-sm tw-font-semibold tw-text-slate-900">
                                <Layers className="tw-h-4 tw-w-4 tw-text-slate-400" aria-hidden /> Projects
                                {formData.projects.length > 0 && (
                                    <span className="tw-rounded-full tw-bg-slate-100 tw-px-2 tw-py-0.5 tw-text-xs tw-font-medium tw-tabular-nums tw-text-slate-600">{formData.projects.length}</span>
                                )}
                            </h2>
                            {formData.projects.length > 0 && (
                                <Button size="sm" onClick={handleOpenModal}>
                                    <Plus className="tw-h-3.5 tw-w-3.5" aria-hidden /> Add project
                                </Button>
                            )}
                        </div>
                        {formData.projects.length > 0 ? (
                            <ul className="tw-divide-y tw-divide-slate-100">
                                {formData.projects.map((project, index) => {
                                    const amount = projectAmount(project);
                                    return (
                                        <li key={project.idProjects ?? index} className="tw-flex tw-flex-wrap tw-items-start tw-gap-4 tw-px-5 tw-py-4">
                                            <span className="tw-inline-flex tw-h-6 tw-w-6 tw-shrink-0 tw-items-center tw-justify-center tw-rounded-lg tw-bg-slate-100 tw-text-xs tw-font-semibold tw-tabular-nums tw-text-slate-500">
                                                {index + 1}
                                            </span>
                                            <div className="tw-min-w-0 tw-flex-1">
                                                <p className="tw-font-semibold tw-text-slate-900">{project.project?.projectName}</p>
                                                <p className="tw-text-xs tw-text-slate-500">
                                                    {project.project?.duration} {project.project?.tenure} · {project.project?.returnRangeMin}–{project.project?.returnRangeMax}% return
                                                </p>
                                                <div className="tw-mt-2 tw-flex tw-flex-wrap tw-gap-1.5">
                                                    {project.projectPartners.map((pp, idx) => (
                                                        <span key={idx} className="tw-inline-flex tw-items-center tw-gap-1 tw-rounded-full tw-bg-slate-100 tw-px-2.5 tw-py-0.5 tw-text-xs tw-text-slate-700">
                                                            {pp.User.fullName}
                                                            <span className="tw-tabular-nums tw-text-slate-500">× {pp.investedUnit}</span>
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                            <div className="tw-text-right">
                                                <p className="tw-font-semibold tw-tabular-nums tw-text-slate-900">{bdt(amount)}</p>
                                                <p className="tw-text-xs tw-tabular-nums tw-text-slate-500">{plural(Number(project.unitPurchased) || 0, "unit")}</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveProject(index)}
                                                className="tw-rounded-lg tw-p-1.5 tw-text-slate-400 tw-transition hover:tw-bg-rose-50 hover:tw-text-rose-600"
                                                aria-label={`Remove ${project.project?.projectName ?? "project"}`}
                                            >
                                                <Trash2 className="tw-h-4 tw-w-4" aria-hidden />
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        ) : (
                            <div className="tw-flex tw-flex-col tw-items-center tw-px-5 tw-py-12 tw-text-center">
                                <span className="tw-flex tw-h-11 tw-w-11 tw-items-center tw-justify-center tw-rounded-2xl tw-bg-brand-50 tw-text-brand-700">
                                    <FolderPlus className="tw-h-5 tw-w-5" aria-hidden />
                                </span>
                                <p className="tw-mt-3 tw-text-sm tw-font-medium tw-text-slate-800">No projects added yet</p>
                                <p className="tw-mt-1 tw-max-w-sm tw-text-xs tw-text-slate-500">Add each project the investor is buying into, and which partners hold the units.</p>
                                <Button variant="primary" className="tw-mt-4" onClick={handleOpenModal}>
                                    <Plus className="tw-h-4 tw-w-4" aria-hidden /> Add project
                                </Button>
                            </div>
                        )}
                    </Card>
                </div>

                <aside className="lg:tw-sticky lg:tw-top-24">
                    <Card className="tw-p-5">
                        <h2 className="tw-flex tw-items-center tw-gap-2 tw-text-sm tw-font-semibold tw-text-slate-900">
                            <Wallet className="tw-h-4 tw-w-4 tw-text-slate-400" aria-hidden /> Summary
                        </h2>
                        <div className="tw-mt-4 tw-flex tw-items-center tw-gap-3">
                            {formData.investor.idUsers ? (
                                <>
                                    <Avatar name={formData.investor.fullName || "?"} seed={formData.investor.idUsers} size="sm" />
                                    <div className="tw-min-w-0">
                                        <p className="tw-truncate tw-text-sm tw-font-semibold tw-text-slate-900">{formData.investor.fullName}</p>
                                        <p className="tw-text-xs tw-tabular-nums tw-text-slate-500">{formData.investor.phoneNumber}</p>
                                    </div>
                                </>
                            ) : (
                                <p className="tw-text-sm tw-text-slate-400">No investor chosen</p>
                            )}
                        </div>
                        <dl className="tw-mt-4 tw-space-y-2 tw-border-t tw-border-slate-100 tw-pt-4 tw-text-sm">
                            <div className="tw-flex tw-justify-between tw-gap-3">
                                <dt className="tw-flex tw-items-center tw-gap-1.5 tw-text-slate-500">
                                    <CalendarDays className="tw-h-3.5 tw-w-3.5" aria-hidden /> Investment date
                                </dt>
                                <dd className="tw-font-medium tw-text-slate-900">{formData.investmentDate ? date(formData.investmentDate) : <span className="tw-text-slate-400">Not set</span>}</dd>
                            </div>
                            <div className="tw-flex tw-justify-between tw-gap-3">
                                <dt className="tw-text-slate-500">Projects</dt>
                                <dd className="tw-font-medium tw-tabular-nums tw-text-slate-900">{formData.projects.length}</dd>
                            </div>
                            <div className="tw-flex tw-justify-between tw-gap-3">
                                <dt className="tw-text-slate-500">Units</dt>
                                <dd className="tw-font-medium tw-tabular-nums tw-text-slate-900">{bookingUnits}</dd>
                            </div>
                            {bookingTotal > 0 && (
                                <div className="tw-flex tw-justify-between tw-gap-3">
                                    <dt className="tw-text-slate-500">Expected back</dt>
                                    <dd className="tw-text-right tw-font-medium tw-tabular-nums tw-text-slate-900">
                                        {bdt(bookingBack.min)} – {bdt(bookingBack.max)}
                                    </dd>
                                </div>
                            )}
                        </dl>
                        <div className="tw-mt-4 tw-flex tw-items-baseline tw-justify-between tw-gap-3 tw-rounded-xl tw-bg-slate-50 tw-px-4 tw-py-3">
                            <span className="tw-text-sm tw-text-slate-600">Total payable</span>
                            <span className="tw-text-xl tw-font-semibold tw-tabular-nums tw-tracking-tight tw-text-slate-900">{bdt(bookingTotal)}</span>
                        </div>
                        <Button variant="primary" type="submit" className="tw-mt-4 tw-w-full" disabled={loading || formData.projects.length === 0}>
                            {loading && <Loader2 className="tw-h-4 tw-w-4 tw-animate-spin" aria-hidden />}
                            {loading ? "Creating…" : "Create booking"}
                        </Button>
                        {formData.projects.length === 0 && <p className="tw-mt-2 tw-text-center tw-text-xs tw-text-slate-500">Add at least one project to continue.</p>}
                    </Card>
                </aside>
            </form>

            <Modal show={showModal} onHide={() => setShowModal(false)} centered size="lg">
                <Modal.Body className="tw-p-0">
                    <div className="ui">
                        <div className="tw-flex tw-items-start tw-justify-between tw-gap-3 tw-border-b tw-border-slate-100 tw-px-6 tw-py-4">
                            <div>
                                <h2 className="tw-text-lg tw-font-semibold tw-text-slate-900">Add a project</h2>
                                <p className="tw-text-sm tw-text-slate-500">Choose the project, then split its units between partners.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowModal(false)}
                                className="tw-rounded-lg tw-p-1.5 tw-text-slate-400 hover:tw-bg-slate-100 hover:tw-text-slate-600"
                                aria-label="Close"
                            >
                                <X className="tw-h-5 tw-w-5" aria-hidden />
                            </button>
                        </div>

                        <div className="tw-space-y-5 tw-px-6 tw-py-5">
                            <Field label={<>Project<Required /></>}>
                                <ReactSelect<ProjectDataType>
                                    instanceId="project"
                                    inputId="project"
                                    options={projects}
                                    isSearchable
                                    isClearable
                                    value={modalProject.project}
                                    onChange={(e: SingleValue<ProjectDataType>) =>
                                        setModalProject({ project: e || null, projectPartners: [] })
                                    }
                                    placeholder="Select project"
                                    styles={selectStyles<ProjectDataType>()}
                                    menuPortalTarget={typeof document !== "undefined" ? document.body : undefined}
                                    formatOptionLabel={(option, { context }) =>
                                        context === "menu" ? (
                                            <div>
                                                <div className="tw-font-medium">{option.projectName}</div>
                                                <div className="tw-text-xs tw-text-slate-500">
                                                    {bdtExact(Number(option.unitInvestmentValue))} a unit · {option.returnRangeMin}–{option.returnRangeMax}% ·{" "}
                                                    {plural(Number(option.totalRemainingUnits) || 0, "unit")} left
                                                </div>
                                            </div>
                                        ) : (
                                            option.projectName
                                        )
                                    }
                                />
                            </Field>

                            {modalProject.project && (
                                <dl className="tw-grid tw-grid-cols-2 tw-gap-px tw-overflow-hidden tw-rounded-xl tw-border tw-border-slate-200 tw-bg-slate-200 sm:tw-grid-cols-4">
                                    {(
                                        [
                                            ["Unit price", bdtExact(Number(unitValue))],
                                            ["Return", `${modalProject.project.returnRangeMin}–${modalProject.project.returnRangeMax}%`],
                                            ["Duration", `${modalProject.project.duration} ${modalProject.project.tenure}`],
                                            ["Units left", remainingUnits !== null && Number.isFinite(remainingUnits) ? String(remainingUnits) : "—"],
                                        ] as [string, string][]
                                    ).map(([label, value]) => (
                                        <div key={label} className="tw-bg-white tw-px-3 tw-py-2.5">
                                            <dt className="tw-text-xs tw-text-slate-500">{label}</dt>
                                            <dd className="tw-mt-0.5 tw-text-sm tw-font-semibold tw-tabular-nums tw-text-slate-900">{value}</dd>
                                        </div>
                                    ))}
                                    {modalProject.project.location && (
                                        <div className="tw-col-span-2 tw-flex tw-items-center tw-gap-1.5 tw-bg-white tw-px-3 tw-py-2 tw-text-xs tw-text-slate-600 sm:tw-col-span-4">
                                            <MapPin className="tw-h-3.5 tw-w-3.5 tw-text-slate-400" aria-hidden /> {modalProject.project.location}
                                        </div>
                                    )}
                                </dl>
                            )}

                            <div>
                                <div className="tw-flex tw-items-center tw-justify-between tw-gap-3">
                                    <p className="tw-text-xs tw-font-semibold tw-uppercase tw-tracking-wider tw-text-slate-500">Partners and units</p>
                                    <Button size="sm" onClick={addPartnerRow} disabled={!modalProject.project || !projectPartners.length}>
                                        <Plus className="tw-h-3.5 tw-w-3.5" aria-hidden /> Add partner
                                    </Button>
                                </div>

                                {modalProject.projectPartners && modalProject.projectPartners.length > 0 ? (
                                    <ul className="tw-mt-3 tw-space-y-2">
                                        {modalProject.projectPartners.map((pp, idx) => {
                                            const capacity = Number(pp.partnerUnitCapacity || 0);
                                            const over = capacity > 0 && Number(pp.investedUnit) > capacity;
                                            return (
                                                <li key={idx} className="tw-rounded-xl tw-border tw-border-slate-200 tw-p-3">
                                                    <div className="tw-flex tw-flex-wrap tw-items-end tw-gap-3 sm:tw-flex-nowrap">
                                                        <Field label="Partner" className="tw-min-w-0 tw-flex-1 tw-basis-full sm:tw-basis-auto">
                                                            <Select value={pp.idProjectPartners || ""} onChange={(e) => selectPartner(idx, Number(e.target.value))}>
                                                                <option value="" disabled>
                                                                    Select partner
                                                                </option>
                                                                {projectPartners.map((partner) => (
                                                                    <option key={partner.idProjectPartners} value={partner.idProjectPartners}>
                                                                        {partner.User.fullName}
                                                                        {Number(partner.partnerUnitCapacity) > 0
                                                                            ? ` — capacity ${partner.partnerUnitCapacity}, ${Number(partner.investorConfirmedBookingCount || 0)} confirmed`
                                                                            : " — no capacity limit"}
                                                                    </option>
                                                                ))}
                                                            </Select>
                                                        </Field>
                                                        <Field label={capacity > 0 ? `Units (max ${capacity})` : "Units"} className="tw-w-32 tw-shrink-0">
                                                            <Input
                                                                type="number"
                                                                min={0}
                                                                max={capacity > 0 ? capacity : undefined}
                                                                value={pp.investedUnit}
                                                                onChange={(e) => setPartnerUnits(idx, e.target.value)}
                                                                className={over ? "tw-border-amber-400" : undefined}
                                                            />
                                                        </Field>
                                                        <div className="tw-min-w-[7rem] tw-flex-1 sm:tw-flex-none">
                                                            <span className="tw-mb-1.5 tw-block tw-text-xs tw-font-medium tw-text-slate-600">Amount</span>
                                                            <p className="tw-rounded-xl tw-bg-slate-50 tw-px-3 tw-py-2 tw-text-sm tw-font-medium tw-tabular-nums tw-text-slate-900">
                                                                {bdt(Number(pp.amountInvested) || 0)}
                                                            </p>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => removePartnerRow(idx)}
                                                            className="tw-shrink-0 tw-rounded-lg tw-p-2 tw-text-slate-400 tw-transition hover:tw-bg-rose-50 hover:tw-text-rose-600"
                                                            aria-label="Remove partner"
                                                        >
                                                            <Trash2 className="tw-h-4 tw-w-4" aria-hidden />
                                                        </button>
                                                    </div>
                                                    {over && (
                                                        <p className="tw-mt-2 tw-flex tw-items-center tw-gap-1.5 tw-text-xs tw-font-medium tw-text-amber-700">
                                                            <ShieldAlert className="tw-h-3.5 tw-w-3.5" aria-hidden /> More units than this partner&apos;s capacity of {capacity}.
                                                        </p>
                                                    )}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                ) : (
                                    <p className="tw-mt-3 tw-rounded-xl tw-border tw-border-dashed tw-border-slate-200 tw-px-4 tw-py-6 tw-text-center tw-text-sm tw-text-slate-500">
                                        {modalProject.project
                                            ? projectPartners.length
                                                ? "Add the partners who will hold this project's units."
                                                : "This project has no partner with room."
                                            : "Choose a project first."}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="tw-flex tw-flex-wrap tw-items-center tw-justify-between tw-gap-3 tw-border-t tw-border-slate-100 tw-bg-slate-50/70 tw-px-6 tw-py-4">
                            <div className="tw-text-sm">
                                <span className="tw-font-semibold tw-tabular-nums tw-text-slate-900">{bdt(modalAmount)}</span>
                                <span className="tw-text-slate-500"> · {plural(modalUnits, "unit")}</span>
                                {modalAmount > 0 && (
                                    <span className="tw-block tw-text-xs tw-tabular-nums tw-text-slate-500">
                                        Expected back {bdt(modalBack.min)} – {bdt(modalBack.max)}
                                    </span>
                                )}
                            </div>
                            <div className="tw-flex tw-gap-2">
                                <Button onClick={() => setShowModal(false)}>Cancel</Button>
                                <Button variant="primary" onClick={handleAddProject}>
                                    Add to booking
                                </Button>
                            </div>
                        </div>
                    </div>
                </Modal.Body>
            </Modal>
        </div>
    );
}

export default Create;

Create.getLayout = function PageLayout(page: React.ReactNode) {
    return <MainLayout>{page}</MainLayout>;
};
