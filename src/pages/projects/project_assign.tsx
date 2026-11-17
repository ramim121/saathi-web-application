import React, { useEffect, useState } from 'react';
import MainLayout from '@/layouts/MainLayout';
import { API_URL } from '@/config/public';
import { deleteRequestOptions, getRequestOptions, postRequestOptions } from '@/utils/Fetch';
import Swal from 'sweetalert2';
import ReactSelect from 'react-select';
import { Link2, Plus, Trash2, X } from 'lucide-react';
import { Avatar, Card, cx } from '@/ui/primitives';
import { Button, Field, Input, Required } from '@/ui/controls';
import { EmptyRow, PageHeader, TableCard, TD, TH, TR } from '@/ui/layout';
import { selectStyles } from '@/ui/select';

interface ProjectOption {
    idProjects: number;
    projectName: string;
    duration: number;
    tenure: string;
    location: string;
    label: string;
    value: number;
}

interface PartnerOption {
    idUsers: number;
    fullName: string;
    phoneNumber: string;
    location: string;
    joiningDate: string;
    label: string;
    value: number;
}

interface AssignRow {
    partner: PartnerOption | null;
    partnerUnitCapacity: number;
}

interface ExistingProjectPartner {
    idProjectPartners: number;
    idUsers: number;
    partnerUnitCapacity: number;
    investorConfirmedBookingCount: number;
    investorAlreadyBookedCount: number;
    User: {
        fullName: string;
        phoneNumber: string;
    };
}

const projectLabel = (option: ProjectOption, { context }: { context: 'menu' | 'value' }) =>
    context === 'menu' ? (
        <div>
            <div className="tw-font-medium">{option.label}</div>
            <div className="tw-text-xs tw-text-slate-500">
                {option.duration} {option.tenure}
                {option.location ? ` · ${option.location}` : ''}
            </div>
        </div>
    ) : (
        option.label
    );

const partnerLabel = (option: PartnerOption, { context }: { context: 'menu' | 'value' }) =>
    context === 'menu' ? (
        <div>
            <div className="tw-font-medium">{option.label}</div>
            <div className="tw-text-xs tw-text-slate-500">{[option.phoneNumber, option.location].filter(Boolean).join(' · ') || '—'}</div>
        </div>
    ) : (
        option.label
    );

function ProjectAssign() {
    const [projectList, setProjectList] = useState<ProjectOption[]>([]);
    const [selectedProject, setSelectedProject] = useState<ProjectOption | null>(null);
    const [partnersList, setPartnersList] = useState<PartnerOption[]>([]);
    const [assignRows, setAssignRows] = useState<AssignRow[]>([{ partner: null, partnerUnitCapacity: 0 }]);
    const [existingPartners, setExistingPartners] = useState<ExistingProjectPartner[]>([]);

    useEffect(() => {
        const fetchProjects = async () => {
            try {
                const res = await fetch('/api/projects/get-projects-for-project-assign', getRequestOptions());
                const data = await res.json();
                if (res.status === 200) {
                    const options = data.data.map((item: ProjectOption) => ({
                        ...item,
                        label: item.projectName,
                        value: item.idProjects
                    }));
                    setProjectList(options);
                    return;
                }
                Swal.fire({ icon: 'error', title: 'Error', text: data.message });
            } catch (error) {
                Swal.fire({ icon: 'error', title: 'Error', text: (error as Error).message });
            }
        };
        fetchProjects();
    }, []);

    useEffect(() => {
        const fetchPartnersForProject = async () => {
            if (!selectedProject) {
                setPartnersList([]);
                setExistingPartners([]);
                setAssignRows([{ partner: null, partnerUnitCapacity: 0 }]);
                return;
            }
            try {
                const [partnerRes, existingRes] = await Promise.all([
                    fetch(`/api/partners/get-partners-for-assign/${selectedProject.value}`, getRequestOptions()),
                    fetch(`/api/projects/project-partners/${selectedProject.value}`, getRequestOptions())
                ]);
                const partnerData = await partnerRes.json();
                const existingData = await existingRes.json();

                if (partnerRes.status === 200) {
                    const options = partnerData.data.map((item: PartnerOption) => ({
                        ...item,
                        label: item.fullName,
                        value: item.idUsers
                    }));
                    setPartnersList(options);
                    setAssignRows([{ partner: null, partnerUnitCapacity: 0 }]);
                } else {
                    Swal.fire({ icon: 'error', title: 'Error', text: partnerData.message });
                }

                if (existingRes.status === 200) {
                    setExistingPartners(existingData.data);
                } else {
                    Swal.fire({ icon: 'error', title: 'Error', text: existingData.message });
                }
            } catch (error) {
                Swal.fire({ icon: 'error', title: 'Error', text: (error as Error).message });
            }
        };
        fetchPartnersForProject();
    }, [selectedProject]);

    const selectedPartnerIds = assignRows
        .map((row) => row.partner?.value)
        .filter((partnerId): partnerId is number => Boolean(partnerId));

    const handleRowChange = (rowIndex: number, updatedRow: AssignRow) => {
        const nextRows = [...assignRows];
        nextRows[rowIndex] = updatedRow;
        setAssignRows(nextRows);
    };

    const addRow = () => {
        setAssignRows((prev) => [...prev, { partner: null, partnerUnitCapacity: 0 }]);
    };

    const removeRow = (rowIndex: number) => {
        setAssignRows((prev) => {
            if (prev.length === 1) {
                return prev;
            }
            return prev.filter((_, index) => index !== rowIndex);
        });
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        if (!selectedProject) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Please select a project' });
            return;
        }

        const invalidRow = assignRows.find((row) => !row.partner || !row.partnerUnitCapacity || row.partnerUnitCapacity <= 0);
        if (invalidRow) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Please select partner and add valid unit capacity for every row' });
            return;
        }

        const payload = {
            project: selectedProject.value,
            partners: assignRows.map((row) => ({
                partner: row.partner?.value,
                partnerUnitCapacity: Number(row.partnerUnitCapacity)
            }))
        };

        Swal.fire({
            title: 'Are you sure?',
            text: 'You want to assign partners to this project!',
            icon: 'warning',
            showCancelButton: true,
            cancelButtonText: 'No',
            confirmButtonText: 'Yes'
        }).then(async (result) => {
            if (!result.value) {
                return;
            }

            try {
                const res = await fetch(API_URL + 'api/projects/project_assign', postRequestOptions(payload));
                if (res.status === 200) {
                    Swal.fire({ icon: 'success', title: 'Success', text: 'Partners assigned successfully!' });
                    setAssignRows([{ partner: null, partnerUnitCapacity: 0 }]);

                    const [partnerRes, existingRes] = await Promise.all([
                        fetch(`/api/partners/get-partners-for-assign/${selectedProject.value}`, getRequestOptions()),
                        fetch(`/api/projects/project-partners/${selectedProject.value}`, getRequestOptions())
                    ]);
                    const partnerData = await partnerRes.json();
                    const existingData = await existingRes.json();
                    if (partnerRes.status === 200) {
                        const options = partnerData.data.map((item: PartnerOption) => ({
                            ...item,
                            label: item.fullName,
                            value: item.idUsers
                        }));
                        setPartnersList(options);
                    }
                    if (existingRes.status === 200) {
                        setExistingPartners(existingData.data);
                    }
                    return;
                }

                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    html: (await res.json()).message
                });
            } catch (error) {
                Swal.fire({ icon: 'error', title: 'Error', text: (error as Error).message });
            }
        });
    };

    const handleDelete = async (idProjectPartners: number) => {
        Swal.fire({
            title: 'Are you sure?',
            text: 'You want to delete this partnership!',
            icon: 'warning',
            showCancelButton: true,
            cancelButtonText: 'No',
            confirmButtonText: 'Yes'
        }).then(async (result) => {
            if (!result.value || !selectedProject) {
                return;
            }

            try {
                const res = await fetch(API_URL + `api/projects/delete-partner-assign/${idProjectPartners}`, deleteRequestOptions());
                if (res.status === 200) {
                    Swal.fire({ icon: 'success', title: 'Success', text: 'Partnership deleted successfully!' });
                    const [partnerRes, existingRes] = await Promise.all([
                        fetch(`/api/partners/get-partners-for-assign/${selectedProject.value}`, getRequestOptions()),
                        fetch(`/api/projects/project-partners/${selectedProject.value}`, getRequestOptions())
                    ]);
                    const partnerData = await partnerRes.json();
                    const existingData = await existingRes.json();
                    if (partnerRes.status === 200) {
                        const options = partnerData.data.map((item: PartnerOption) => ({
                            ...item,
                            label: item.fullName,
                            value: item.idUsers
                        }));
                        setPartnersList(options);
                    }
                    if (existingRes.status === 200) {
                        setExistingPartners(existingData.data);
                    }
                    return;
                }

                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    html: (await res.json()).message
                });
            } catch (error) {
                Swal.fire({ icon: 'error', title: 'Error', text: (error as Error).message });
            }
        });
    };

    const canAddPartners = Boolean(selectedProject) && partnersList.length > 0;
    const menuPortalTarget = typeof document !== 'undefined' ? document.body : undefined;

    return (
        <div className="ui">
            <PageHeader
                eyebrow="Projects"
                title="Assign projects"
                description="Choose a project, then add partners and the number of units each can hold. Partners already on the project are listed below."
            />

            <Card className="tw-p-5">
                <form onSubmit={handleSubmit} className="tw-space-y-5">
                    <Field label={<>Project<Required /></>} className="tw-max-w-xl">
                        <ReactSelect<ProjectOption>
                            instanceId="project"
                            inputId="project"
                            options={projectList}
                            isSearchable
                            isClearable
                            placeholder="Search projects"
                            styles={selectStyles<ProjectOption>()}
                            formatOptionLabel={projectLabel}
                            onChange={(selectedOption: ProjectOption | null) => setSelectedProject(selectedOption)}
                            value={selectedProject}
                        />
                    </Field>

                    <div>
                        <div className="tw-mb-2 tw-flex tw-items-center tw-justify-between tw-gap-3">
                            <p className="tw-text-xs tw-font-semibold tw-uppercase tw-tracking-wider tw-text-slate-500">Partners to add</p>
                            {selectedProject && partnersList.length === 0 && <p className="tw-text-xs tw-text-slate-500">Every partner is already on this project.</p>}
                        </div>
                        <ul className="tw-space-y-2">
                            {assignRows.map((row, index) => (
                                <li key={`assign-row-${index}`} className="tw-flex tw-flex-wrap tw-items-center tw-gap-3 tw-rounded-xl tw-border tw-border-slate-200 tw-p-3 sm:tw-flex-nowrap">
                                    <span className="tw-inline-flex tw-h-6 tw-w-6 tw-shrink-0 tw-items-center tw-justify-center tw-rounded-lg tw-bg-slate-100 tw-text-xs tw-font-semibold tw-tabular-nums tw-text-slate-500">
                                        {index + 1}
                                    </span>
                                    <div className="tw-min-w-[14rem] tw-flex-1">
                                        <ReactSelect<PartnerOption>
                                            instanceId={`partner-${index}`}
                                            aria-label={`Partner ${index + 1}`}
                                            options={partnersList.filter((partner) => {
                                                if (row.partner?.value === partner.value) {
                                                    return true;
                                                }
                                                return !selectedPartnerIds.includes(partner.value);
                                            })}
                                            isSearchable
                                            isClearable
                                            isDisabled={!selectedProject || partnersList.length === 0}
                                            placeholder={`Partner ${index + 1}`}
                                            styles={selectStyles<PartnerOption>()}
                                            menuPortalTarget={menuPortalTarget}
                                            formatOptionLabel={partnerLabel}
                                            onChange={(selectedOption: PartnerOption | null) =>
                                                handleRowChange(index, {
                                                    ...row,
                                                    partner: selectedOption
                                                })
                                            }
                                            value={row.partner}
                                        />
                                    </div>
                                    {/* Sized by the wrapper: the input's own w-full would win over a width class. */}
                                    <div className="tw-w-28 tw-shrink-0">
                                        <Input
                                            type="number"
                                            min={1}
                                            placeholder="Units"
                                            aria-label={`Unit capacity for partner ${index + 1}`}
                                            value={row.partnerUnitCapacity || ''}
                                            onChange={(e) =>
                                                handleRowChange(index, {
                                                    ...row,
                                                    partnerUnitCapacity: Number(e.target.value)
                                                })
                                            }
                                            disabled={!selectedProject}
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => removeRow(index)}
                                        disabled={assignRows.length === 1}
                                        className="tw-rounded-lg tw-p-2 tw-text-slate-400 tw-transition hover:tw-bg-rose-50 hover:tw-text-rose-600 disabled:tw-cursor-not-allowed disabled:tw-opacity-40 disabled:hover:tw-bg-transparent disabled:hover:tw-text-slate-400"
                                        aria-label={`Remove row ${index + 1}`}
                                    >
                                        <X className="tw-h-4 tw-w-4" aria-hidden />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-2 tw-border-t tw-border-slate-100 tw-pt-4">
                        <Button onClick={addRow} disabled={!canAddPartners}>
                            <Plus className="tw-h-4 tw-w-4" aria-hidden /> Add another partner
                        </Button>
                        <Button variant="primary" type="submit" disabled={!selectedProject} className="tw-ml-auto">
                            <Link2 className="tw-h-4 tw-w-4" aria-hidden /> Assign {assignRows.length > 1 ? `${assignRows.length} partners` : 'partner'}
                        </Button>
                    </div>
                </form>
            </Card>

            <TableCard
                className="tw-mt-6"
                toolbar={
                    <p className="tw-text-sm tw-font-semibold tw-text-slate-900">
                        {selectedProject ? `Partners on ${selectedProject.projectName}` : 'Partners on the project'}
                    </p>
                }
            >
                <thead>
                    <tr>
                        <th className={TH}>Partner</th>
                        <th className={cx(TH, 'tw-text-right')}>Unit capacity</th>
                        <th className={cx(TH, 'tw-text-right')}>Confirmed bookings</th>
                        <th className={cx(TH, 'tw-text-right')}>Awaiting payment</th>
                        <th className={cx(TH, 'tw-text-right')}>
                            <span className="tw-sr-only">Actions</span>
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {existingPartners.length === 0 && (
                        <EmptyRow colSpan={5} title={selectedProject ? 'No partner assigned yet' : 'Select a project to view partners'} />
                    )}
                    {existingPartners.map((item) => (
                        <tr key={item.idProjectPartners} className={TR}>
                            <td className={TD}>
                                <div className="tw-flex tw-items-center tw-gap-2.5">
                                    <Avatar name={item.User?.fullName || '?'} seed={item.idUsers || item.idProjectPartners} size="sm" />
                                    <div className="tw-min-w-0">
                                        <div className="tw-font-medium tw-text-slate-900">{item.User?.fullName}</div>
                                        {item.User?.phoneNumber && <div className="tw-text-xs tw-tabular-nums tw-text-slate-500">{item.User.phoneNumber}</div>}
                                    </div>
                                </div>
                            </td>
                            <td className={cx(TD, 'tw-text-right tw-tabular-nums')}>
                                {Number(item.partnerUnitCapacity) > 0 ? item.partnerUnitCapacity : <span className="tw-text-slate-400">No limit</span>}
                            </td>
                            <td className={cx(TD, 'tw-text-right tw-tabular-nums')}>{item.investorConfirmedBookingCount}</td>
                            <td className={cx(TD, 'tw-text-right tw-tabular-nums')}>{item.investorAlreadyBookedCount}</td>
                            <td className={cx(TD, 'tw-text-right')}>
                                {/* A pending booking holds an allocation too, and the database
                                    refuses to delete a partnership that has one. */}
                                {Number(item.investorConfirmedBookingCount) === 0 && Number(item.investorAlreadyBookedCount) === 0 && (
                                    <Button size="sm" variant="danger-outline" onClick={() => handleDelete(item.idProjectPartners)}>
                                        <Trash2 className="tw-h-3.5 tw-w-3.5" aria-hidden /> Remove
                                    </Button>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </TableCard>
        </div>
    );
}

export default ProjectAssign;

ProjectAssign.getLayout = function PageLayout(page: any) {
    return <MainLayout>{page}</MainLayout>;
};
