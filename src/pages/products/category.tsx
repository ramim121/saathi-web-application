import React, { useState, useEffect, useRef } from 'react';
import { API_URL } from '@/config/public';
import MainLayout from '@/layouts/MainLayout';
import { getRequestOptions } from '@/utils/Fetch';
import Swal from 'sweetalert2';
import { getCookie } from '@/utils/GetCookie';
import { S3_URL } from '@/config/public';
import { ImageOff, Loader2, Pencil, Plus, Tags } from 'lucide-react';
import { Card, Pill, SafeImg, Segmented, cx } from '@/ui/primitives';
import { Button, Field, FileInput, Input, Required } from '@/ui/controls';
import { EmptyRow, PageHeader, TableCard, TD, TH, TR } from '@/ui/layout';
import { ListFooter, ListToolbar, SortTH, useListState } from '@/ui/table';
import { LocalPreview } from '@/components/projects/ProjectFormParts';

interface FormDataType {
    idProductCategories?: string;
    productCategoryName: string;
    productCategoryId?: string;
    categoryImage: any;
    status: 'active' | 'inactive';
}

const EMPTY_FORM: FormDataType = {
    productCategoryName: '',
    categoryImage: '',
    status: 'active',
};

const DEFAULTS = {
    q: '',
    status: '',
    orderBy: 'idProductCategories',
    orderType: 'DESC' as 'ASC' | 'DESC',
    page: 1,
    pageSize: 10,
};

function Category() {
    const [formData, setFormData] = useState<FormDataType>(EMPTY_FORM);
    const list = useListState(DEFAULTS);
    const { state, update } = list;
    const [total, setTotal] = useState<number>(0);
    const [productCategoryList, setProductCategoryList] = useState<FormDataType[]>([]);
    const [reloadKey, setReloadKey] = useState<number>(0);
    const [loading, setLoading] = useState<boolean>(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleOnChange = (e: React.ChangeEvent<any>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    }

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

    useEffect(() => {
        if (!list.ready) return;
        // Ignore answers a newer request replaced.
        let stale = false;
        const fetchProductCategoryList = async () => {
            try {
                const res = await fetch(`/api/product-categories/list?${list.query}`, getRequestOptions());
                const data = await res.json();
                if (stale) return;
                if (res.status === 200) {
                    setProductCategoryList(data.data);
                    setTotal(Number(data.total) || 0);
                } else {
                    Swal.fire({ icon: 'error', title: 'Error', text: data.message });
                }
            } catch (err: any) {
                if (!stale) Swal.fire({ icon: 'error', title: 'Error', text: err.message });
            }
        }
        fetchProductCategoryList();
        return () => {
            stale = true;
        };
    }, [list.query, list.ready, reloadKey]);

    const handleEditChange = (product: FormDataType) => () => {
        setFormData({
            idProductCategories: product.idProductCategories,
            productCategoryName: product.productCategoryName,
            productCategoryId: product.productCategoryId,
            categoryImage: product.categoryImage,
            status: product.status,
        });
        if (fileInputRef.current) fileInputRef.current.value = '';
    }

    const cancelEdit = () => {
        setFormData(EMPTY_FORM);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        Swal.fire({
            title: 'Are you sure?',
            text: formData.idProductCategories ? "You want to update this category!" : "You want to create this category!",
            icon: 'warning',
            showCancelButton: true,
            cancelButtonText: 'No',
            confirmButtonText: 'Yes'
        }).then(async (result) => {
            if (result.value) {
                const newFormData = new FormData();
                newFormData.append('productCategoryName', formData.productCategoryName);
                newFormData.append('status', formData.status);
                newFormData.append('categoryImage', formData.categoryImage);
                if (formData.idProductCategories) {
                    if (formData.productCategoryId) {
                        newFormData.append('productCategoryId', formData.productCategoryId);
                    }
                }

                let url = ''
                if (formData.idProductCategories) {
                    url = API_URL + 'api/product-categories/update/' + formData.idProductCategories;
                } else {
                    url = API_URL + 'api/product-categories/create';
                }

                try {
                    const res = await fetch(url, {
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
                        setFormData(EMPTY_FORM);
                        if (fileInputRef.current) {
                            fileInputRef.current.value = '';  // Clear file input
                        }
                        setReloadKey((k) => k + 1);
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
    }

    const editing = Boolean(formData.idProductCategories);
    const anyFilter = state.status !== '' || state.q !== '';

    return (
        <div className="ui">
            <PageHeader eyebrow="Shathi Mart" title="Product categories" description="The shelves the Mart's products sit on. Edit a row to rename it, change its image or hide it." />

            <div className="tw-grid tw-grid-cols-1 tw-items-start tw-gap-6 lg:tw-grid-cols-[minmax(0,1fr)_22rem]">
                <TableCard
                    toolbar={
                        <ListToolbar
                            search={state.q}
                            onSearch={(q) => update({ q }, { typing: true })}
                            placeholder="Category name, code or #"
                            onReset={() => list.reset()}
                            left={
                                <Segmented
                                    label="Status"
                                    value={state.status}
                                    onChange={(status) => update({ status })}
                                    options={[
                                        { value: '', label: 'All' },
                                        { value: 'active', label: 'Active' },
                                        { value: 'inactive', label: 'Inactive' },
                                    ]}
                                />
                            }
                        />
                    }
                    footer={<ListFooter page={state.page} pageSize={state.pageSize} total={total} noun="categories" onPage={(page) => update({ page })} onPageSize={(pageSize) => update({ pageSize })} />}
                >
                    <thead>
                        <tr>
                            <SortTH label="Category" field="productCategoryName" sort={state} onSort={list.sortBy} />
                            <SortTH label="Code" field="productCategoryId" sort={state} onSort={list.sortBy} />
                            <SortTH label="Status" field="status" sort={state} onSort={list.sortBy} />
                            <th className={cx(TH, 'tw-text-right')}>
                                <span className="tw-sr-only">Edit</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {productCategoryList.length > 0 ? productCategoryList.map((product) => (
                            <tr key={product.idProductCategories} className={cx(TR, formData.idProductCategories === product.idProductCategories && 'tw-bg-brand-50/50')}>
                                <td className={TD}>
                                    <div className="tw-flex tw-items-center tw-gap-3">
                                        <SafeImg
                                            src={product.categoryImage ? `${S3_URL}product-category-image/${product.categoryImage}` : null}
                                            className="tw-h-10 tw-w-10 tw-shrink-0 tw-rounded-xl tw-object-cover tw-ring-1 tw-ring-slate-200"
                                            fallback={
                                                <span className="tw-flex tw-h-10 tw-w-10 tw-shrink-0 tw-items-center tw-justify-center tw-rounded-xl tw-bg-slate-100 tw-text-slate-400">
                                                    <Tags className="tw-h-4 tw-w-4" aria-hidden />
                                                </span>
                                            }
                                        />
                                        <div>
                                            <div className="tw-font-medium tw-text-slate-900">{product.productCategoryName}</div>
                                            <div className="tw-text-xs tw-tabular-nums tw-text-slate-400">#{product.idProductCategories}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className={cx(TD, 'tw-font-mono tw-text-xs tw-text-slate-600')}>{product.productCategoryId || '—'}</td>
                                <td className={TD}>
                                    <Pill tone={product.status === 'active' ? 'green' : 'slate'}>{product.status === 'active' ? 'Active' : 'Inactive'}</Pill>
                                </td>
                                <td className={cx(TD, 'tw-text-right')}>
                                    <Button size="sm" variant="ghost" onClick={handleEditChange(product)}>
                                        <Pencil className="tw-h-3.5 tw-w-3.5" aria-hidden /> Edit
                                    </Button>
                                </td>
                            </tr>
                        )) : (
                            <EmptyRow colSpan={4} title="No categories match" hint={anyFilter ? 'Try a different search or status.' : undefined} />
                        )}
                    </tbody>
                </TableCard>

                <Card className="tw-p-5 lg:tw-sticky lg:tw-top-24">
                    <div className="tw-flex tw-items-start tw-justify-between tw-gap-2">
                        <h2 className="tw-text-sm tw-font-semibold tw-text-slate-900">{editing ? `Edit category #${formData.idProductCategories}` : 'New category'}</h2>
                        {editing && (
                            <button type="button" onClick={cancelEdit} className="tw-text-xs tw-font-medium tw-text-slate-500 hover:tw-text-slate-800">
                                Cancel edit
                            </button>
                        )}
                    </div>
                    <form onSubmit={handleSubmit} className="tw-mt-4 tw-space-y-4">
                        <Field label={<>Category name<Required /></>}>
                            <Input type="text" placeholder="e.g. Spices" name="productCategoryName" onChange={handleOnChange} value={formData.productCategoryName} />
                        </Field>
                        {editing && (
                            <Field label="Category code" hint="Assigned automatically.">
                                <Input type="text" name="productCategoryId" value={formData.productCategoryId ?? ''} disabled />
                            </Field>
                        )}
                        <Field label={<>Image{!editing && <Required />}</>}>
                            <FileInput accept="image/jpeg,image/png" name="categoryImage" onChange={handleFileUpload} ref={fileInputRef} />
                        </Field>
                        {formData.categoryImage instanceof File ? (
                            <LocalPreview file={formData.categoryImage} className="tw-h-32 tw-w-full tw-rounded-xl tw-object-cover tw-ring-1 tw-ring-slate-200" />
                        ) : editing && typeof formData.categoryImage === 'string' && formData.categoryImage ? (
                            <SafeImg
                                src={`${S3_URL}product-category-image/${formData.categoryImage}`}
                                alt={formData.productCategoryName}
                                className="tw-h-32 tw-w-full tw-rounded-xl tw-object-cover tw-ring-1 tw-ring-slate-200"
                                fallback={
                                    <span className="tw-flex tw-h-32 tw-w-full tw-items-center tw-justify-center tw-rounded-xl tw-bg-slate-50 tw-text-slate-300 tw-ring-1 tw-ring-slate-200">
                                        <ImageOff className="tw-h-6 tw-w-6" aria-hidden />
                                    </span>
                                }
                            />
                        ) : null}
                        <div>
                            <p className="tw-mb-1.5 tw-text-xs tw-font-medium tw-text-slate-600">
                                Status<Required />
                            </p>
                            <Segmented<'active' | 'inactive'>
                                label="Status"
                                value={formData.status}
                                onChange={(value) => setFormData({ ...formData, status: value })}
                                options={[
                                    { value: 'active', label: 'Active' },
                                    { value: 'inactive', label: 'Inactive' },
                                ]}
                            />
                        </div>
                        <Button variant="primary" type="submit" className="tw-w-full" disabled={loading}>
                            {loading ? <Loader2 className="tw-h-4 tw-w-4 tw-animate-spin" aria-hidden /> : editing ? <Pencil className="tw-h-4 tw-w-4" aria-hidden /> : <Plus className="tw-h-4 tw-w-4" aria-hidden />}
                            {editing ? 'Save category' : 'Create category'}
                        </Button>
                    </form>
                </Card>
            </div>
        </div>
    );
}

export default Category;

Category.getLayout = function PageLayout(page: any) {
    return (
        <MainLayout>
            {page}
        </MainLayout>
    )
}
