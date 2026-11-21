import React, { useState, useEffect, useRef } from "react";
import MainLayout from "@/layouts/MainLayout";
import Swal from 'sweetalert2';
import { API_URL, S3_URL } from '@/config/public';
import { getCookie } from '@/utils/GetCookie';
import { getRequestOptions } from '@/utils/Fetch';
import { Pencil, Star, Trash2, User } from 'lucide-react';
import { Avatar, SafeImg, cx } from '@/ui/primitives';
import { Button, Field, FileInput, Input, Required, Select, Textarea } from '@/ui/controls';
import { EmptyRow, TableCard, TD, TH, TR } from '@/ui/layout';
import { ListFooter, ListToolbar, SortTH, filterChips, useListState } from '@/ui/table';
import { SetupFormCard, SetupShell } from '@/components/setup/SetupShell';
import { LocalPreview } from '@/components/projects/ProjectFormParts';

interface FormDataType {
    idInvestorTestimonials?: number;
    name: string;
    nameBn: string;
    image: string | File;
    rating: number | null;
    testimonial: string;
    testimonialBn: string;
    priority: number | null;
}

const DEFAULTS = {
    q: '',
    rating: '',
    priority: '',
    orderBy: 'idInvestorTestimonials',
    orderType: 'DESC' as 'ASC' | 'DESC',
    page: 1,
    pageSize: 10,
};

const EMPTY_FORM: FormDataType = {
    idInvestorTestimonials: undefined,
    name: '',
    nameBn: '',
    image: '',
    rating: null,
    testimonial: '',
    testimonialBn: '',
    priority: null
};

const PHOTO = 'tw-h-12 tw-w-12 tw-shrink-0 tw-rounded-full tw-object-cover tw-ring-1 tw-ring-slate-200';

/** Label suffix for a field that may be left blank (the form is too tall for hint lines). */
const Optional = () => <span className="tw-ml-1 tw-font-normal tw-text-slate-400">· optional</span>;

// The column is DECIMAL, so a loaded row's rating arrives as "4.00".
const starsOf = (value: unknown) => Math.round(Number(value) || 0);

function Stars({ value }: { value: unknown }) {
    const rating = starsOf(value);
    return (
        <span className="tw-inline-flex tw-items-center tw-gap-0.5" title={`${rating} of 5`}>
            {[1, 2, 3, 4, 5].map((star) => (
                <Star
                    key={star}
                    className={cx('tw-h-3.5 tw-w-3.5', star <= rating ? 'tw-fill-amber-400 tw-text-amber-400' : 'tw-fill-slate-100 tw-text-slate-200')}
                    aria-hidden
                />
            ))}
            <span className="tw-sr-only">{rating} of 5</span>
        </span>
    );
}

function StarInput({ value, onChange }: { value: unknown; onChange: (rating: number) => void }) {
    const current = starsOf(value);
    return (
        <div role="radiogroup" aria-label="Rating" className="tw-flex tw-items-center tw-gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
                <button
                    key={star}
                    type="button"
                    role="radio"
                    aria-checked={star === current}
                    aria-label={`${star} star${star > 1 ? 's' : ''}`}
                    onClick={() => onChange(star)}
                    className="tw-rounded-md tw-p-0.5 tw-transition hover:tw-scale-110 focus-visible:tw-outline-none focus-visible:tw-ring-2 focus-visible:tw-ring-brand-500"
                >
                    <Star className={cx('tw-h-5 tw-w-5', star <= current ? 'tw-fill-amber-400 tw-text-amber-400' : 'tw-fill-slate-100 tw-text-slate-300')} aria-hidden />
                </button>
            ))}
            <span className="tw-ml-1 tw-text-xs tw-tabular-nums tw-text-slate-500">{current ? `${current} of 5` : 'Not rated'}</span>
        </div>
    );
}

function InvestorTestimonialSetup() {
    const [formData, setFormData] = useState<FormDataType>(EMPTY_FORM);

    const list = useListState(DEFAULTS);
    const { state, update } = list;
    const [total, setTotal] = useState<number>(0);
    const [testimonialList, setTestimonialList] = useState<FormDataType[]>([]);
    const [reloadKey, setReloadKey] = useState<number>(0);
    const [loading, setLoading] = useState<boolean>(false);
    const [isEditing, setIsEditing] = useState<boolean>(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!list.ready) return;
        // Ignore answers a newer request replaced.
        let stale = false;
        const fetchInvestorTestimonials = async () => {
            try {
                const res = await fetch(`/api/investor-testimonials/list?${list.query}`, getRequestOptions());
                const data = await res.json();
                if (stale) return;
                if (res.status === 200) {
                    // A delete can empty the last page: go to the new last page.
                    if (data.data.length === 0 && list.settled.page > 1 && Number(data.total) > 0) {
                        update({ page: Math.ceil(Number(data.total) / list.settled.pageSize) });
                        return;
                    }
                    setTestimonialList(data.data);
                    setTotal(Number(data.total) || 0);
                } else {
                    Swal.fire({ icon: 'error', title: 'Error', text: data.message });
                }
            } catch (err: any) {
                if (!stale) Swal.fire({ icon: 'error', title: 'Error', text: err.message });
            }
        };
        fetchInvestorTestimonials();
        return () => {
            stale = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [list.query, list.ready, reloadKey]);

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
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);

        Swal.fire({
            title: 'Are you sure?',
            text: isEditing ? "You want to update this testimonial!" : "You want to create this testimonial!",
            icon: 'warning',
            showCancelButton: true,
            cancelButtonText: 'No',
            confirmButtonText: 'Yes'
        }).then(async (result) => {
            if (result.value) {
                const newFormData = new FormData();
                if (isEditing && formData.idInvestorTestimonials) {
                    newFormData.append('idInvestorTestimonials', formData.idInvestorTestimonials.toString());
                }
                newFormData.append('name', formData.name);
                newFormData.append('rating', formData.rating?.toString() || '');
                newFormData.append('testimonial', formData.testimonial);
                newFormData.append('priority', formData.priority?.toString() || '');
                newFormData.append('nameBn', formData.nameBn || '');
                newFormData.append('testimonialBn', formData.testimonialBn || '');

                if (formData.image instanceof File) {
                    newFormData.append('image', formData.image);
                }

                try {
                    const url = isEditing ? API_URL + 'api/investor-testimonials/update' : API_URL + 'api/investor-testimonials/create';
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
                        setReloadKey((k) => k + 1);
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

    const handleEdit = (item: FormDataType) => {
        setFormData({
            idInvestorTestimonials: item.idInvestorTestimonials,
            name: item.name,
            nameBn: item.nameBn || '',
            image: item.image,
            rating: item.rating,
            testimonial: item.testimonial,
            testimonialBn: item.testimonialBn || '',
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
            text: "You want to delete this testimonial!",
            icon: 'warning',
            showCancelButton: true,
            cancelButtonText: 'No',
            confirmButtonText: 'Yes'
        }).then(async (result) => {
            if (result.value) {
                try {
                    const res = await fetch(API_URL + `api/investor-testimonials/delete?idInvestorTestimonials=${id}`, {
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
                        setReloadKey((k) => k + 1);
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

    const chips = filterChips(state, list.defaults, {
        rating: (v) => `${v} star${v === '1' ? '' : 's'}`,
        priority: 'Priority',
    }, update);
    const anyFilter = chips.length > 0 || state.q !== '';

    return (
        <SetupShell
            title="Investor testimonials"
            description="Quotes from investors shown in the app, in priority order."
            list={
                <TableCard
                    toolbar={
                        <ListToolbar
                            search={state.q}
                            onSearch={(q) => update({ q }, { typing: true })}
                            placeholder="Name or quote (English or বাংলা), or #"
                            chips={chips}
                            onReset={() => list.reset()}
                            filters={
                                <>
                                    <Field label="Rating">
                                        <Select {...list.bind('rating')}>
                                            <option value="">All</option>
                                            {[5, 4, 3, 2, 1].map((n) => (
                                                <option key={n} value={n}>{n} star{n > 1 ? 's' : ''}</option>
                                            ))}
                                        </Select>
                                    </Field>
                                    <Field label="Priority">
                                        <Input type="number" placeholder="Any" {...list.bind('priority')} />
                                    </Field>
                                </>
                            }
                        />
                    }
                    footer={<ListFooter page={state.page} pageSize={state.pageSize} total={total} noun="testimonials" onPage={(page) => update({ page })} onPageSize={(pageSize) => update({ pageSize })} />}
                >
                    <thead>
                        <tr>
                            <SortTH label="Investor" field="name" sort={state} onSort={list.sortBy} />
                            <th className={TH}>Testimonial</th>
                            <SortTH label="Priority" field="priority" sort={state} onSort={list.sortBy} align="right" />
                            <th className={cx(TH, 'tw-text-right')}>
                                <span className="tw-sr-only">Actions</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {testimonialList.length > 0 ? testimonialList.map((item, index) => (
                            <tr key={item.idInvestorTestimonials ?? index} className={cx(TR, isEditing && formData.idInvestorTestimonials === item.idInvestorTestimonials && 'tw-bg-brand-50/50')}>
                                <td className={TD}>
                                    <div className="tw-flex tw-items-center tw-gap-3">
                                        <SafeImg
                                            src={typeof item.image === 'string' && item.image ? `${S3_URL}investor-testimonials/${item.image}` : null}
                                            alt=""
                                            className="tw-h-10 tw-w-10 tw-shrink-0 tw-rounded-full tw-object-cover tw-ring-1 tw-ring-slate-200"
                                            fallback={<Avatar name={item.name || '?'} seed={item.idInvestorTestimonials ?? index} />}
                                        />
                                        <div className="tw-min-w-[8rem]">
                                            <div className="tw-font-medium tw-text-slate-900">{item.name}</div>
                                            {item.nameBn && (
                                                <div lang="bn" className="tw-text-xs tw-text-slate-500">
                                                    {item.nameBn}
                                                </div>
                                            )}
                                            <div className="tw-mt-0.5 tw-flex tw-items-center tw-gap-2 tw-text-xs">
                                                <Stars value={item.rating} />
                                                <span className="tw-tabular-nums tw-text-slate-400">#{item.idInvestorTestimonials}</span>
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td className={TD}>
                                    <p className="tw-line-clamp-2 tw-min-w-[12rem] tw-max-w-md tw-text-slate-600" title={item.testimonial}>
                                        {item.testimonial}
                                    </p>
                                    {item.testimonialBn && <span className="tw-mt-1 tw-inline-block tw-text-[11px] tw-font-medium tw-text-slate-400">+ বাংলা</span>}
                                </td>
                                <td className={cx(TD, 'tw-text-right tw-tabular-nums')}>{item.priority}</td>
                                <td className={cx(TD, 'tw-whitespace-nowrap tw-text-right')}>
                                    <div className="tw-inline-flex tw-gap-1">
                                        <Button size="sm" variant="ghost" onClick={() => handleEdit(item)}>
                                            <Pencil className="tw-h-3.5 tw-w-3.5" aria-hidden /> Edit
                                        </Button>
                                        <button
                                            type="button"
                                            onClick={() => handleDelete(item.idInvestorTestimonials)}
                                            className="tw-rounded-lg tw-p-2 tw-text-slate-400 hover:tw-bg-rose-50 hover:tw-text-rose-600"
                                            aria-label={`Delete the testimonial from ${item.name}`}
                                        >
                                            <Trash2 className="tw-h-3.5 tw-w-3.5" aria-hidden />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        )) : (
                            <EmptyRow colSpan={4} title="No testimonials match" hint={anyFilter ? 'Try fewer filters.' : undefined} />
                        )}
                    </tbody>
                </TableCard>
            }
            form={
                <SetupFormCard noun="testimonial" editingId={isEditing ? formData.idInvestorTestimonials : null} onCancelEdit={cancelEdit} onSubmit={handleSubmit} loading={loading}>
                    <Field label={<>Name<Required /></>}>
                        <Input type="text" placeholder="Investor's name" name="name" onChange={(e) => setFormData({ ...formData, name: e.target.value })} value={formData.name} />
                    </Field>
                    {/* Bangla counterparts are optional; blank falls back to English. */}
                    <Field label={<>Name (বাংলা)<Optional /></>}>
                        <Input type="text" placeholder="নাম লিখুন" name="nameBn" lang="bn" onChange={(e) => setFormData({ ...formData, nameBn: e.target.value })} value={formData.nameBn} />
                    </Field>
                    <div>
                        <p className="tw-mb-1.5 tw-text-xs tw-font-medium tw-text-slate-600">
                            Photo<Required />
                        </p>
                        <div className="tw-flex tw-items-center tw-gap-3">
                            {formData.image instanceof File ? (
                                <LocalPreview file={formData.image} className={PHOTO} />
                            ) : (
                                <SafeImg
                                    src={formData.image ? `${S3_URL}investor-testimonials/${formData.image}` : null}
                                    alt={formData.name}
                                    className={PHOTO}
                                    fallback={
                                        <span className="tw-flex tw-h-12 tw-w-12 tw-shrink-0 tw-items-center tw-justify-center tw-rounded-full tw-border tw-border-dashed tw-border-slate-300 tw-text-slate-400">
                                            <User className="tw-h-5 tw-w-5" aria-hidden />
                                        </span>
                                    }
                                />
                            )}
                            <div className="tw-min-w-0 tw-flex-1">
                                <FileInput accept="image/jpeg,image/png" name="image" aria-label="Photo" onChange={handleFileUpload} ref={fileInputRef} />
                            </div>
                        </div>
                        <p className="tw-mt-1 tw-text-xs tw-text-slate-500">{isEditing ? 'Leave empty to keep the current photo.' : 'JPEG or PNG.'}</p>
                    </div>
                    <div className="tw-grid tw-grid-cols-[minmax(0,1fr)_5.5rem] tw-items-start tw-gap-3">
                        <div>
                            <p className="tw-mb-1.5 tw-text-xs tw-font-medium tw-text-slate-600">
                                Rating<Required />
                            </p>
                            <StarInput value={formData.rating} onChange={(rating) => setFormData({ ...formData, rating })} />
                        </div>
                        <Field label={<>Priority<Required /></>} hint="Lower first">
                            <Input type="number" placeholder="1" name="priority" onChange={(e) => setFormData({ ...formData, priority: e.target.value ? parseInt(e.target.value) : null })} value={formData.priority || ''} />
                        </Field>
                    </div>
                    <Field label={<>Testimonial<Required /></>}>
                        <Textarea rows={4} placeholder="What the investor said" name="testimonial" value={formData.testimonial} onChange={(e) => setFormData({ ...formData, testimonial: e.target.value })} />
                    </Field>
                    <Field label={<>Testimonial (বাংলা)<Optional /></>}>
                        <Textarea rows={3} placeholder="বাংলায় প্রশংসাপত্র লিখুন" name="testimonialBn" lang="bn" value={formData.testimonialBn} onChange={(e) => setFormData({ ...formData, testimonialBn: e.target.value })} />
                    </Field>
                </SetupFormCard>
            }
        />
    );
}

export default InvestorTestimonialSetup;

InvestorTestimonialSetup.getLayout = function PageLayout(page: any) {
    return (
        <MainLayout>
            {page}
        </MainLayout>
    );
};
