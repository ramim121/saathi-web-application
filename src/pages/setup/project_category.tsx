import React, { useState, useEffect, useRef } from "react";
import MainLayout from "@/layouts/MainLayout";
import Swal from 'sweetalert2';
import { API_URL } from '@/config/public';
import { getCookie } from '@/utils/GetCookie';
import { getRequestOptions } from '@/utils/Fetch';
import { S3_URL } from '@/config/public';
import { Layers3 } from 'lucide-react';
import { SafeImg, cx } from '@/ui/primitives';
import { Field, FileInput, Input, Required } from '@/ui/controls';
import { EmptyRow, TableCard, TD, TR } from '@/ui/layout';
import { ListFooter, ListToolbar, SortTH, useListState } from '@/ui/table';
import { SetupFormCard, SetupShell } from '@/components/setup/SetupShell';
import { LocalPreview } from '@/components/projects/ProjectFormParts';

interface FormDataType {
    idProjectCategories?: number
    categoryName: string
    categoryNameBn: string
    categoryImage: File | null
}

const DEFAULTS = {
    q: '',
    orderBy: 'idProjectCategories',
    orderType: 'ASC' as 'ASC' | 'DESC',
    page: 1,
    pageSize: 10,
};

function ProjectCategory() {
    const [formData, setFormData] = useState<FormDataType>({
        categoryName: '',
        categoryNameBn: '',
        categoryImage: null
    });
    const list = useListState(DEFAULTS);
    const { state, update } = list;
    const [total, setTotal] = useState<number>(0);
    const [projectCategories, setProjectCategories] = useState<FormDataType[]>([]);
    const [reloadKey, setReloadKey] = useState<number>(0);
    const [loading, setLoading] = useState<boolean>(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!list.ready) return;
        // Ignore answers a newer request replaced.
        let stale = false;
        const fetchProjectCategoryList = async () => {
            try {
                const res = await fetch(`/api/project-categories/list?${list.query}`, getRequestOptions());
                const data = await res.json();
                if (stale) return;
                if (res.status === 200) {
                    setProjectCategories(data.data);
                    setTotal(Number(data.total) || 0);
                } else {
                    Swal.fire({ icon: 'error', title: 'Error', text: data.message });
                }
            } catch (err: any) {
                if (!stale) Swal.fire({ icon: 'error', title: 'Error', text: err.message });
            }
        }
        fetchProjectCategoryList();
        return () => {
            stale = true;
        };
    }, [list.query, list.ready, reloadKey]);

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const fileType = file.type;
            const validImageTypes = ['image/jpeg', 'image/png', 'image/jpg'];
            if (validImageTypes.includes(fileType)) {
                setFormData({ ...formData, categoryImage: file });
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
            text: "You want to create this project category!",
            icon: 'warning',
            showCancelButton: true,
            cancelButtonText: 'No',
            confirmButtonText: 'Yes'
        }).then(async (result) => {
            if (result.value) {
                const newFormData = new FormData();
                newFormData.append('categoryName', formData.categoryName);
                newFormData.append('categoryNameBn', formData.categoryNameBn || '');
                if (formData.categoryImage !== null) {
                    newFormData.append('categoryImage', formData.categoryImage);
                }

                try {
                    const res = await fetch(API_URL + 'api/project-categories/create', {
                        method: 'POST',
                        headers: { 'Authorization': 'Bearer ' + getCookie('saathi-token') },
                        body: newFormData,
                    });

                    if (res.status === 200) {
                        Swal.fire({
                            icon: 'success',
                            title: 'Success',
                            text: (await res.json()).message,
                        });
                        setReloadKey((k) => k + 1);
                        setFormData({
                            categoryName: '',
                            categoryNameBn: '',
                            categoryImage: null
                        });
                        if (fileInputRef.current) {
                            fileInputRef.current.value = '';  // Clear file input
                        }
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

    return (
        <SetupShell
            title="Project categories"
            description="How projects are grouped in the app and on the website."
            list={
                <TableCard
                    toolbar={<ListToolbar search={state.q} onSearch={(q) => update({ q }, { typing: true })} placeholder="Search categories (English or বাংলা) or #" onReset={() => list.reset()} />}
                    footer={<ListFooter page={state.page} pageSize={state.pageSize} total={total} noun="categories" onPage={(page) => update({ page })} onPageSize={(pageSize) => update({ pageSize })} />}
                >
                    <thead>
                        <tr>
                            <SortTH label="#" field="idProjectCategories" sort={state} onSort={list.sortBy} className="tw-w-20" />
                            <SortTH label="Category" field="categoryName" sort={state} onSort={list.sortBy} />
                        </tr>
                    </thead>
                    <tbody>
                        {projectCategories.length > 0 ? projectCategories.map((project, index) => (
                            <tr key={project.idProjectCategories ?? index} className={TR}>
                                <td className={cx(TD, 'tw-tabular-nums tw-text-slate-400')}>{project.idProjectCategories}</td>
                                <td className={TD}>
                                    <div className="tw-flex tw-items-center tw-gap-3">
                                        <SafeImg
                                            src={project.categoryImage ? `${S3_URL}project-category-image/${project.categoryImage}` : null}
                                            alt=""
                                            className="tw-h-10 tw-w-10 tw-shrink-0 tw-rounded-xl tw-object-cover tw-ring-1 tw-ring-slate-200"
                                            fallback={
                                                <span className="tw-flex tw-h-10 tw-w-10 tw-shrink-0 tw-items-center tw-justify-center tw-rounded-xl tw-bg-slate-100 tw-text-slate-400">
                                                    <Layers3 className="tw-h-4 tw-w-4" aria-hidden />
                                                </span>
                                            }
                                        />
                                        <div>
                                            <div className="tw-font-medium tw-text-slate-900">{project.categoryName}</div>
                                            {project.categoryNameBn && (
                                                <div lang="bn" className="tw-text-xs tw-text-slate-500">
                                                    {project.categoryNameBn}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        )) : (
                            <EmptyRow colSpan={2} title="No categories match" hint={state.q ? 'Try a different search.' : undefined} />
                        )}
                    </tbody>
                </TableCard>
            }
            form={
                <SetupFormCard noun="category" onSubmit={handleSubmit} loading={loading}>
                    <Field label={<>Category name<Required /></>}>
                        <Input type="text" name="categoryName" placeholder="e.g. Agriculture and livestock" value={formData.categoryName} onChange={(e) => setFormData({ ...formData, categoryName: e.target.value })} required />
                    </Field>
                    {/* Bangla counterpart — optional; blank falls back to English. */}
                    <Field label="Category name (বাংলা)">
                        <Input type="text" name="categoryNameBn" lang="bn" placeholder="বিভাগের নাম — ঐচ্ছিক" value={formData.categoryNameBn} onChange={(e) => setFormData({ ...formData, categoryNameBn: e.target.value })} />
                    </Field>
                    <Field label="Image" hint="JPEG or PNG.">
                        <FileInput accept="image/jpeg,image/png" name="categoryImage" onChange={handleFileUpload} ref={fileInputRef} />
                    </Field>
                    {formData.categoryImage instanceof File && (
                        <LocalPreview file={formData.categoryImage} className="tw-h-28 tw-w-full tw-rounded-xl tw-object-cover tw-ring-1 tw-ring-slate-200" />
                    )}
                </SetupFormCard>
            }
        />
    )
}

export default ProjectCategory;

ProjectCategory.getLayout = function PageLayout(page: any) {
    return (
        <MainLayout>
            {page}
        </MainLayout>
    )
}
