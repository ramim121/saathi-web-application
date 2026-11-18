import React, { useState, useEffect, useRef } from "react";
import MainLayout from "@/layouts/MainLayout";
import Swal from 'sweetalert2';
import { API_URL, S3_URL } from '@/config/public';
import { getCookie } from '@/utils/GetCookie';
import { getRequestOptions } from '@/utils/Fetch';
import { Handshake, Pencil, Trash2 } from 'lucide-react';
import { SafeImg, cx } from '@/ui/primitives';
import { Button, Field, FileInput, Input, Required, SearchInput } from '@/ui/controls';
import { EmptyRow, Pager, TableCard, TD, TH, TR } from '@/ui/layout';
import { SetupFormCard, SetupShell } from '@/components/setup/SetupShell';
import { LocalPreview } from '@/components/projects/ProjectFormParts';

interface PartnershipFormData {
    idPartnerships?: number;
    name: string;
    nameBn: string;
    image: string | File;
    priority: number | null;
}

interface FilterProps {
    idPartnerships: string;
    name: string;
    orderBy: string;
    orderType: string;
    page: number;
    pageSize: number;
}

const EMPTY_FORM: PartnershipFormData = {
    idPartnerships: undefined,
    name: '',
    nameBn: '',
    image: '',
    priority: null
};

function LogoTile({ image, name, size }: { image: string | File; name: string; size: 'sm' | 'lg' }) {
    const box = size === 'lg' ? 'tw-h-24 tw-w-24' : 'tw-h-11 tw-w-11';
    return (
        <SafeImg
            src={typeof image === 'string' && image ? `${S3_URL}partnerships/${image}` : null}
            alt={name}
            className={cx(box, 'tw-shrink-0 tw-rounded-xl tw-bg-white tw-object-contain tw-p-1 tw-ring-1 tw-ring-slate-200')}
            fallback={
                <span className={cx(box, 'tw-flex tw-shrink-0 tw-items-center tw-justify-center tw-rounded-xl tw-bg-slate-100 tw-text-slate-400')}>
                    <Handshake className="tw-h-4 tw-w-4" aria-hidden />
                </span>
            }
        />
    );
}

function PartnershipPage() {
    const [formData, setFormData] = useState<PartnershipFormData>(EMPTY_FORM);

    const [filter, setFilter] = useState<FilterProps>({
        idPartnerships: '',
        name: '',
        orderBy: 'idPartnerships',
        orderType: 'DESC',
        page: 1,
        pageSize: 10
    });

    const [total, setTotal] = useState<number>(0);
    const [totalPages, setTotalPages] = useState<number>(1);
    const [partnershipList, setPartnershipList] = useState<PartnershipFormData[]>([]);
    const [reload, setReload] = useState<boolean>(true);
    const [loading, setLoading] = useState<boolean>(false);
    const [isEditing, setIsEditing] = useState<boolean>(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        // A filter fires a request per keystroke; ignore answers a newer request replaced.
        let stale = false;
        const fetchPartnershipList = async () => {
            const query = new URLSearchParams(filter as any).toString();
            try {
                const res = await fetch(`/api/partnerships/list?${query}`, getRequestOptions());
                const data = await res.json();
                if (stale) return;
                if (res.status === 200) {
                    setPartnershipList(data.data);
                    setTotal(data.total);
                    setTotalPages(data.totalPages);
                    setReload(false);
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: data.message,
                    });
                }
            } catch (err: any) {
                if (stale) return;
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: err.message,
                });
            }
        }
        fetchPartnershipList();
        return () => {
            stale = true;
        };
    }, [filter, reload]);

    // A changed filter starts again from page 1.
    const handleInputOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFilter({
            ...filter,
            [name]: value,
            page: 1
        });
    }

    const pages = Math.max(1, totalPages || 1);
    const handlePageChange = (page: number) => {
        setFilter({
            ...filter,
            page: Math.min(Math.max(1, page), pages)
        })
    }

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const fileType = file.type;
            const validImageTypes = ['image/jpeg', 'image/png', 'image/jpg'];
            if (validImageTypes.includes(fileType)) {
                setFormData({ ...formData, image: file });
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Invalid file type. Please upload a jpeg, jpg, or png image.',
                });
            }
        }
    }

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);

        Swal.fire({
            title: 'Are you sure?',
            text: isEditing ? "You want to update this partnership!" : "You want to create this partnership!",
            icon: 'warning',
            showCancelButton: true,
            cancelButtonText: 'No',
            confirmButtonText: 'Yes'
        }).then(async (result) => {
            if (result.value) {
                const newFormData = new FormData();
                if (isEditing && formData.idPartnerships) {
                    newFormData.append('idPartnerships', formData.idPartnerships.toString());
                }
                newFormData.append('name', formData.name);
                newFormData.append('nameBn', formData.nameBn || '');
                if (formData.image instanceof File) {
                    newFormData.append('image', formData.image);
                }
                newFormData.append('priority', formData.priority?.toString() || '');
                try {
                    const url = isEditing ? API_URL + 'api/partnerships/update' : API_URL + 'api/partnerships/create';
                    const res = await fetch(url, {
                        method: 'POST',
                        headers: { 'Authorization': 'Bearer ' + getCookie('saathi-token') },
                        body: newFormData,
                    });

                    const data = await res.json();

                    if (res.status === 200) {
                        Swal.fire({
                            icon: 'success',
                            title: 'Success',
                            text: data.message,
                        });
                        setReload(true);
                        setFormData(EMPTY_FORM);
                        setIsEditing(false);
                        if (fileInputRef.current) {
                            fileInputRef.current.value = '';
                        }
                    } else {
                        Swal.fire({
                            icon: 'error',
                            title: 'Error',
                            html: data.message,
                        });
                    }
                } catch (err) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: 'Something went wrong!',
                    });
                } finally {
                    setLoading(false);
                }
            } else {
                setLoading(false);
            }
        });
    };

    const handleEdit = (item: PartnershipFormData) => {
        setFormData({
            idPartnerships: item.idPartnerships,
            name: item.name,
            nameBn: item.nameBn || '',
            image: item.image,
            priority: item.priority
        });
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
        setIsEditing(true);
    };

    const cancelEdit = () => {
        setFormData(EMPTY_FORM);
        setIsEditing(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleDelete = async (id?: number) => {
        if (!id) return;

        Swal.fire({
            title: 'Are you sure?',
            text: "You want to delete this partnership!",
            icon: 'warning',
            showCancelButton: true,
            cancelButtonText: 'No',
            confirmButtonText: 'Yes'
        }).then(async (result) => {
            if (result.value) {
                try {
                    const res = await fetch(API_URL + `api/partnerships/delete?idPartnerships=${id}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': 'Bearer ' + getCookie('saathi-token') },
                    });
                    const data = await res.json();
                    if (res.status === 200) {
                        Swal.fire({
                            icon: 'success',
                            title: 'Success',
                            text: data.message,
                        });
                        setReload(true);
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
                        text: err.message || 'Something went wrong!',
                    });
                }
            }
        });
    };

    return (
        <SetupShell
            title="Partnerships"
            description="Organisations Shathi works with, shown as logos in the app in priority order."
            list={
                <TableCard
                    toolbar={
                        <div className="tw-grid tw-grid-cols-[1fr_6rem] tw-gap-3">
                            <Field label="Name">
                                <SearchInput placeholder="Search partnerships" name="name" onChange={handleInputOnChange} value={filter.name} />
                            </Field>
                            <Field label="#">
                                <Input type="number" placeholder="ID" name="idPartnerships" onChange={handleInputOnChange} value={filter.idPartnerships} />
                            </Field>
                        </div>
                    }
                    footer={<Pager page={filter.page} totalPages={pages} onChange={handlePageChange} summary={total ? `${total} partnerships · page ${filter.page} of ${pages}` : undefined} />}
                >
                    <thead>
                        <tr>
                            <th className={TH}>Partnership</th>
                            <th className={cx(TH, 'tw-text-right')}>Priority</th>
                            <th className={cx(TH, 'tw-text-right')}>
                                <span className="tw-sr-only">Actions</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {partnershipList.length > 0 ? partnershipList.map((item, index) => (
                            <tr key={item.idPartnerships ?? index} className={cx(TR, isEditing && formData.idPartnerships === item.idPartnerships && 'tw-bg-brand-50/50')}>
                                <td className={TD}>
                                    <div className="tw-flex tw-items-center tw-gap-3">
                                        <LogoTile image={item.image} name={item.name} size="sm" />
                                        <div className="tw-min-w-0">
                                            <div className="tw-font-medium tw-text-slate-900">{item.name}</div>
                                            <div className="tw-text-xs tw-text-slate-500">
                                                <span className="tw-tabular-nums tw-text-slate-400">#{item.idPartnerships}</span>
                                                {item.nameBn && (
                                                    <>
                                                        {' · '}
                                                        <span lang="bn">{item.nameBn}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td className={cx(TD, 'tw-text-right tw-tabular-nums')}>{item.priority}</td>
                                <td className={cx(TD, 'tw-whitespace-nowrap tw-text-right')}>
                                    <div className="tw-inline-flex tw-gap-1">
                                        <Button size="sm" variant="ghost" onClick={() => handleEdit(item)}>
                                            <Pencil className="tw-h-3.5 tw-w-3.5" aria-hidden /> Edit
                                        </Button>
                                        <button
                                            type="button"
                                            onClick={() => handleDelete(item.idPartnerships)}
                                            className="tw-rounded-lg tw-p-2 tw-text-slate-400 hover:tw-bg-rose-50 hover:tw-text-rose-600"
                                            aria-label={`Delete ${item.name}`}
                                        >
                                            <Trash2 className="tw-h-3.5 tw-w-3.5" aria-hidden />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        )) : (
                            <EmptyRow colSpan={3} title="No partnerships match" hint={filter.name || filter.idPartnerships ? 'Try a different search.' : undefined} />
                        )}
                    </tbody>
                </TableCard>
            }
            form={
                <SetupFormCard noun="partnership" editingId={isEditing ? formData.idPartnerships : null} onCancelEdit={cancelEdit} onSubmit={handleSubmit} loading={loading}>
                    <Field label={<>Name<Required /></>}>
                        <Input type="text" placeholder="e.g. BRAC" name="name" onChange={(e) => setFormData({ ...formData, name: e.target.value })} value={formData.name} />
                    </Field>
                    {/* Bangla counterpart. Optional — content is written in English
                        first and translated afterwards, so leaving this blank simply
                        falls back to the English name. */}
                    <Field label="Name (বাংলা)" hint="Optional; falls back to the English name.">
                        <Input type="text" placeholder="অংশীদারের নাম লিখুন" name="nameBn" lang="bn" onChange={(e) => setFormData({ ...formData, nameBn: e.target.value })} value={formData.nameBn} />
                    </Field>
                    <div>
                        <Field label={<>Logo<Required /></>} hint={isEditing ? 'Leave empty to keep the current logo.' : 'JPEG or PNG.'}>
                            <FileInput accept="image/jpeg,image/png" name="image" onChange={handleFileUpload} ref={fileInputRef} />
                        </Field>
                        {formData.image instanceof File ? (
                            <LocalPreview file={formData.image} className="tw-mt-2 tw-h-24 tw-w-24 tw-rounded-xl tw-bg-white tw-object-contain tw-p-1 tw-ring-1 tw-ring-slate-200" />
                        ) : formData.image ? (
                            <div className="tw-mt-2">
                                <LogoTile image={formData.image} name={formData.name} size="lg" />
                            </div>
                        ) : null}
                    </div>
                    <Field label={<>Priority<Required /></>} hint="Lower numbers show first.">
                        <Input type="number" placeholder="e.g. 1" name="priority" onChange={(e) => setFormData({ ...formData, priority: e.target.value ? parseInt(e.target.value) : null })} value={formData.priority || ''} />
                    </Field>
                </SetupFormCard>
            }
        />
    )
}

export default PartnershipPage;

PartnershipPage.getLayout = function PageLayout(page: any) {
    return (
        <MainLayout>
            {page}
        </MainLayout>
    )
}
