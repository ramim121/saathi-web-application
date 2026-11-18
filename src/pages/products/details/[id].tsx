/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import MainLayout from "@/layouts/MainLayout";
import { useRouter } from "next/router";
import { getRequestOptions, postRequestOptions } from "@/utils/Fetch";
import Swal from "sweetalert2";
import { API_URL } from '@/config/public';
import { getCookie } from '@/utils/GetCookie';
import { S3_URL } from '@/config/public';
import ReactSelect from 'react-select';
import { ArrowLeft, Download, ImageOff, Loader2, Package, Plus, Upload, UserPlus } from "lucide-react";
import { Avatar, Card, Pill, SafeImg, Segmented, Skeleton, cx } from "@/ui/primitives";
import { Button, Field, FileInput, Input, Required } from "@/ui/controls";
import { EmptyRow, TableCard, TD, TH, TR } from "@/ui/layout";
import { selectStyles } from "@/ui/select";
import { bdtExact } from "@/ui/format";
import { words } from "@/ui/status";

interface DetailsProps {
    idProducts: number,
    productName: string,
    idProductCategories: number,
    idUnit: number,
    productDescription: string,
    ProductCategory: {
        idProductCategories: number,
        productCategoryName: string
    },
    Unit: {
        idUnit: number,
        unitName: string
    },
    ProductImages: {
        idProductImages: number,
        imageName: string,
        imageNameOriginal: string,
        imageStatus: string
    }[],
    ProductPartners: {
        idProductPartners: number,
        sellRate: number,
        User: {
            idUsers: number,
            fullName: string,
            email: string,
            phoneNumber: string,
            joiningDate: string
        },
        ProductPacking: {
            idProductPackings: number,
            packingName: string,
            size: string
        }
    }[]
    ProductPackings: {
        idProductPackings: number,
        packingName: string,
        size: string,
    }[]
}

interface PartnerProps {
    idUsers: number,
    fullName: string,
    email: string,
    phoneNumber: string,
    joiningDate: string,
}

interface PackingProps {
    idProductPackings?: number,
    packingName: string,
    size: string,
}

type Tab = 'overview' | 'images' | 'packings' | 'partners';

function Details() {
    const router = useRouter();
    const { id } = router.query;
    const [details, setDetails] = useState<DetailsProps>({} as DetailsProps);
    const [partners, setPartners] = useState<PartnerProps[]>([]);
    const [images, setImages] = useState<any>('');
    const fileRef = useRef<HTMLInputElement>(null);
    const [reload, setReload] = useState<boolean>(false);
    const [tab, setTab] = useState<Tab>('overview');
    const [assignedPartners, setAssignedPartners] = useState<PartnerProps>({
        idUsers: 0,
        fullName: '',
        email: '',
        phoneNumber: '',
        joiningDate: ''
    });
    const [selectedPacking, setSelectedPacking] = useState<PackingProps>({} as PackingProps);
    const [sellRate, setSellRate] = useState<number>(0);
    const [loading, setLoading] = useState<boolean>(false);
    const [packing, setPacking] = useState<PackingProps>({
        packingName: '',
        size: ''
    });
    const [packingList, setPackingList] = useState<PackingProps[]>([]);

    useEffect(() => {
        if (id != undefined) {
            fetchProductDetails();
            fetchPartners();
            fetchProductPacking();
        }
    }, [id])

    useEffect(() => {
        if (reload) {
            fetchProductDetails();
            // The partner tab's packing picker reads this list; it used to keep
            // showing the old packings until the page was reloaded.
            fetchProductPacking();
        }
    }, [reload])

    const fetchProductDetails = async () => {
        try {
            const res = await fetch('/api/products/details/' + id, getRequestOptions());
            const data = await res.json();
            if (res.status === 200) {
                setDetails(data.data);
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
        setReload(false);
    }

    const fetchPartners = async () => {
        try {
            const res = await fetch(API_URL + 'api/products/get_partner_for_assign', getRequestOptions());
            const data = await res.json();
            if (res.status === 200) {
                setPartners(data.data);
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: data.message,
                });
            }
        } catch (err) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Something went wrong!',
            });
        }
    };

    const fetchProductPacking = async () => {
        try {
            const res = await fetch('/api/products/get-product-packing/' + id, getRequestOptions());
            const data = await res.json();
            if (res.status === 200) {
                setPackingList(data.data);
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

    const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (files) {
            const validImageTypes = ['image/jpeg', 'image/png', 'image/jpg'];
            const invalidFiles = [];
            for (let i = 0; i < files.length; i++) {
                const fileType = files[i].type;
                if (!validImageTypes.includes(fileType)) {
                    invalidFiles.push(files[i].name);
                }
            }
            if (invalidFiles.length > 0) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: `Invalid file type. The following files are not jpeg, jpg, or png images: ${invalidFiles.join(', ')}`,
                });
            } else {
                setImages(files);
            }
        }
    }

    const handleImageUpload = async (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        e.preventDefault();
        if (images === '') {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Please select a image to upload!',
            });
            return;
        }
        Swal.fire({
            title: 'Are you sure?',
            text: 'Do you want to upload this images?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Yes',
            cancelButtonText: 'No',
            showLoaderOnConfirm: true,
            allowOutsideClick: false,
            preConfirm: async () => {
                const formData = new FormData();
                if (id) {
                    formData.append('idProducts', id.toString());
                } else {
                    throw new Error('Product ID is undefined');
                }
                if (images && images.length > 0) {
                    for (let i = 0; i < images.length; i++) {
                        formData.append('productImages', images[i]);
                    }
                }
                try {
                    const response = await fetch(API_URL + 'api/products/images_upload', {
                        method: 'POST',
                        headers: { 'Authorization': 'Bearer ' + getCookie('saathi-token') },
                        body: formData,
                    });
                    if (response.ok) {
                        Swal.fire({
                            icon: 'success',
                            title: 'Success',
                            text: 'Images uploaded successfully!',
                        });
                        fileRef.current!.value = '';
                        setImages('');
                        setReload(true);
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

    const handlePartnerAssign = async (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        e.preventDefault();
        Swal.fire({
            title: 'Are you sure?',
            text: 'Do you want to assign the partner?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Yes',
            cancelButtonText: 'No',
            showLoaderOnConfirm: true,
            allowOutsideClick: false,
            preConfirm: async () => {
                const formData = {
                    idProducts: id,
                    partners: assignedPartners,
                    sellRate: sellRate,
                    packing: selectedPacking
                }
                try {
                    setLoading(true);
                    const response = await fetch(API_URL + 'api/products/assign_partners', postRequestOptions(formData));
                    if (response.ok) {
                        Swal.fire({
                            icon: 'success',
                            title: 'Success',
                            text: 'Partner assigned successfully!',
                        });
                        setReload(true);
                        setAssignedPartners({
                            idUsers: 0,
                            fullName: '',
                            email: '',
                            phoneNumber: '',
                            joiningDate: ''
                        });
                        setSellRate(0);
                        setSelectedPacking({} as PackingProps);
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
                } finally {
                    setLoading(false);
                }
            },
        });
    };

    const handlePackingSubmit = async (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        e.preventDefault();
        Swal.fire({
            title: 'Are you sure?',
            text: 'Do you want to add this packing?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Yes',
            cancelButtonText: 'No',
            showLoaderOnConfirm: true,
            allowOutsideClick: false,
            preConfirm: async () => {
                const formData = {
                    packingName: packing.packingName,
                    size: packing.size,
                    idProducts: id
                }
                try {
                    setLoading(true);
                    const response = await fetch(API_URL + 'api/products/add_packing', postRequestOptions(formData));
                    if (response.ok) {
                        Swal.fire({
                            icon: 'success',
                            title: 'Success',
                            text: 'Packing added successfully!',
                        });
                        setReload(true);
                        setPacking({
                            packingName: '',
                            size: ''
                        });
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
                } finally {
                    setLoading(false);
                }
            },
        });
    };

    const loaded = Boolean(details.idProducts);
    const productImages = details.ProductImages ?? [];
    const packings = details.ProductPackings ?? [];
    const productPartners = details.ProductPartners ?? [];
    const partnerOptions = partners.map((partner) => ({ ...partner, value: partner.idUsers, label: partner.fullName }));
    const packingOptions = packingList.map((p) => ({ ...p, value: p.idProductPackings, label: p.packingName + ' - ' + p.size }));
    const menuPortalTarget = typeof document !== 'undefined' ? document.body : undefined;

    return (
        <div className="ui">
            <Link href="/products/list" className="tw-mb-3 tw-inline-flex tw-items-center tw-gap-1.5 tw-text-sm tw-font-medium tw-text-slate-500 hover:tw-text-slate-900">
                <ArrowLeft className="tw-h-4 tw-w-4" aria-hidden /> Products
            </Link>
            <div className="tw-mb-6 tw-flex tw-items-center tw-gap-4">
                <span className="tw-flex tw-h-14 tw-w-14 tw-shrink-0 tw-items-center tw-justify-center tw-rounded-2xl tw-bg-brand-50 tw-text-brand-700">
                    <Package className="tw-h-6 tw-w-6" aria-hidden />
                </span>
                <div className="tw-min-w-0">
                    <p className="tw-text-xs tw-font-semibold tw-uppercase tw-tracking-[0.14em] tw-text-brand-700">Product{loaded ? ` #${details.idProducts}` : ''}</p>
                    {loaded ? (
                        <h1 className="tw-mt-1 tw-text-[26px] tw-font-semibold tw-leading-8 tw-tracking-tight tw-text-slate-900">{details.productName}</h1>
                    ) : (
                        <Skeleton className="tw-mt-2 tw-h-7 tw-w-56" />
                    )}
                    {loaded && (
                        <p className="tw-mt-1 tw-text-sm tw-text-slate-500">
                            {[details.ProductCategory?.productCategoryName, details.Unit?.unitName].filter(Boolean).join(' · ')}
                        </p>
                    )}
                </div>
            </div>

            <div className="tw-mb-5">
                <Segmented<Tab>
                    label="Product sections"
                    value={tab}
                    onChange={setTab}
                    options={[
                        { value: 'overview', label: 'Overview' },
                        { value: 'images', label: 'Photos', count: productImages.length },
                        { value: 'packings', label: 'Packings', count: packings.length },
                        { value: 'partners', label: 'Partners', count: productPartners.length },
                    ]}
                />
            </div>

            {tab === 'overview' && (
                <Card className="tw-max-w-3xl tw-p-5">
                    <dl className="tw-grid tw-grid-cols-1 tw-gap-x-6 tw-gap-y-4 sm:tw-grid-cols-2">
                        <div>
                            <dt className="tw-text-xs tw-font-medium tw-text-slate-500">Category</dt>
                            <dd className="tw-mt-0.5 tw-text-sm tw-text-slate-800">{details.ProductCategory?.productCategoryName || '—'}</dd>
                        </div>
                        <div>
                            <dt className="tw-text-xs tw-font-medium tw-text-slate-500">Unit</dt>
                            <dd className="tw-mt-0.5 tw-text-sm tw-text-slate-800">{details.Unit?.unitName || '—'}</dd>
                        </div>
                        <div className="sm:tw-col-span-2">
                            <dt className="tw-text-xs tw-font-medium tw-text-slate-500">Description</dt>
                            <dd className="tw-mt-0.5 tw-whitespace-pre-line tw-text-sm tw-text-slate-800">{details.productDescription || '—'}</dd>
                        </div>
                    </dl>
                </Card>
            )}

            {tab === 'images' && (
                <div className="tw-space-y-4">
                    <Card className="tw-flex tw-flex-wrap tw-items-end tw-gap-3 tw-p-5">
                        <Field label="Add photos" hint="JPEG or PNG; several at once." className="tw-min-w-[16rem] tw-flex-1">
                            <FileInput ref={fileRef} multiple accept="image/jpeg,image/png" onChange={handleImageChange} />
                        </Field>
                        <Button variant="primary" onClick={handleImageUpload} className="tw-mb-5">
                            <Upload className="tw-h-4 tw-w-4" aria-hidden /> Upload
                        </Button>
                    </Card>
                    {productImages.length === 0 ? (
                        <Card className="tw-flex tw-flex-col tw-items-center tw-gap-2 tw-py-10 tw-text-sm tw-text-slate-500">
                            <ImageOff className="tw-h-6 tw-w-6 tw-text-slate-400" aria-hidden />
                            No photos yet.
                        </Card>
                    ) : (
                        <ul className="tw-grid tw-grid-cols-2 tw-gap-3 sm:tw-grid-cols-3 lg:tw-grid-cols-4">
                            {productImages.map((image) => {
                                const url = `${S3_URL}product-image/${id}/${image.imageName}`;
                                return (
                                    <li key={image.idProductImages} className="tw-overflow-hidden tw-rounded-xl tw-border tw-border-slate-200 tw-bg-white">
                                        <SafeImg
                                            src={url}
                                            alt={image.imageNameOriginal}
                                            className="tw-aspect-[4/3] tw-w-full tw-object-cover"
                                            fallback={
                                                <span className="tw-flex tw-aspect-[4/3] tw-w-full tw-items-center tw-justify-center tw-bg-slate-50 tw-text-slate-300">
                                                    <ImageOff className="tw-h-6 tw-w-6" aria-hidden />
                                                </span>
                                            }
                                        />
                                        <div className="tw-flex tw-items-center tw-gap-2 tw-border-t tw-border-slate-200 tw-px-2.5 tw-py-1.5">
                                            <span className="tw-min-w-0 tw-flex-1 tw-truncate tw-text-xs tw-text-slate-600" title={image.imageNameOriginal}>{image.imageNameOriginal}</span>
                                            {image.imageStatus && <Pill tone={image.imageStatus === 'active' ? 'green' : 'slate'} dot={false}>{words(image.imageStatus)}</Pill>}
                                            <button
                                                type="button"
                                                onClick={() => window.open(url, '_blank')}
                                                className="tw-rounded-md tw-p-1 tw-text-slate-400 hover:tw-bg-slate-100 hover:tw-text-slate-700"
                                                aria-label={`Download ${image.imageNameOriginal}`}
                                            >
                                                <Download className="tw-h-3.5 tw-w-3.5" aria-hidden />
                                            </button>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            )}

            {tab === 'packings' && (
                <div className="tw-grid tw-grid-cols-1 tw-items-start tw-gap-6 lg:tw-grid-cols-[minmax(0,1fr)_20rem]">
                    <TableCard>
                        <thead>
                            <tr>
                                <th className={cx(TH, 'tw-w-12')}>#</th>
                                <th className={TH}>Packing</th>
                                <th className={TH}>Size</th>
                            </tr>
                        </thead>
                        <tbody>
                            {packings.length > 0 ? (
                                packings.map((p, index) => (
                                    <tr key={p.idProductPackings ?? index} className={TR}>
                                        <td className={cx(TD, 'tw-tabular-nums tw-text-slate-400')}>{index + 1}</td>
                                        <td className={cx(TD, 'tw-font-medium tw-text-slate-900')}>{p.packingName}</td>
                                        <td className={cx(TD, 'tw-text-slate-600')}>{p.size || '—'}</td>
                                    </tr>
                                ))
                            ) : (
                                <EmptyRow colSpan={3} title="No packings yet" hint="Add one to sell this product in it." />
                            )}
                        </tbody>
                    </TableCard>
                    <Card className="tw-p-5">
                        <h2 className="tw-text-sm tw-font-semibold tw-text-slate-900">Add a packing</h2>
                        <div className="tw-mt-4 tw-space-y-4">
                            <Field label={<>Packing name<Required /></>}>
                                <Input type="text" placeholder="e.g. Sack" name="packingName" onChange={(e) => setPacking({ ...packing, packingName: e.target.value })} value={packing.packingName} />
                            </Field>
                            <Field label="Size">
                                <Input type="text" placeholder="e.g. 25 kg" name="size" onChange={(e) => setPacking({ ...packing, size: e.target.value })} value={packing.size} />
                            </Field>
                            <Button variant="primary" className="tw-w-full" disabled={loading} onClick={handlePackingSubmit}>
                                {loading ? <Loader2 className="tw-h-4 tw-w-4 tw-animate-spin" aria-hidden /> : <Plus className="tw-h-4 tw-w-4" aria-hidden />}
                                Add packing
                            </Button>
                        </div>
                    </Card>
                </div>
            )}

            {tab === 'partners' && (
                <div className="tw-grid tw-grid-cols-1 tw-items-start tw-gap-6 lg:tw-grid-cols-[minmax(0,1fr)_20rem]">
                    <TableCard>
                        <thead>
                            <tr>
                                <th className={TH}>Partner</th>
                                <th className={TH}>Contact</th>
                                <th className={TH}>Packing</th>
                                <th className={cx(TH, 'tw-text-right')}>Sell rate</th>
                            </tr>
                        </thead>
                        <tbody>
                            {productPartners.length > 0 ? (
                                productPartners.map((partner, index) => (
                                    <tr key={partner.idProductPartners ?? index} className={TR}>
                                        <td className={TD}>
                                            <div className="tw-flex tw-items-center tw-gap-2.5">
                                                <Avatar name={partner.User?.fullName || '?'} seed={partner.User?.idUsers || index} size="sm" />
                                                <Link href={`/partners/details/${partner.User?.idUsers}`} className="tw-font-medium tw-text-slate-900 hover:tw-text-brand-700">
                                                    {partner.User?.fullName}
                                                </Link>
                                            </div>
                                        </td>
                                        <td className={cx(TD, 'tw-text-xs tw-text-slate-600')}>
                                            <div className="tw-tabular-nums">{partner.User?.phoneNumber || '—'}</div>
                                            {partner.User?.email && <div className="tw-text-slate-500">{partner.User.email}</div>}
                                        </td>
                                        <td className={cx(TD, 'tw-text-slate-700')}>
                                            {partner.ProductPacking?.packingName}
                                            {partner.ProductPacking?.size && <span className="tw-text-slate-500"> · {partner.ProductPacking.size}</span>}
                                        </td>
                                        <td className={cx(TD, 'tw-text-right tw-font-medium tw-tabular-nums tw-text-slate-900')}>{bdtExact(Number(partner.sellRate))}</td>
                                    </tr>
                                ))
                            ) : (
                                <EmptyRow colSpan={4} title="No partners supply this yet" />
                            )}
                        </tbody>
                    </TableCard>
                    <Card className="tw-p-5">
                        <h2 className="tw-text-sm tw-font-semibold tw-text-slate-900">Assign a partner</h2>
                        <div className="tw-mt-4 tw-space-y-4">
                            <Field label={<>Partner<Required /></>}>
                                <ReactSelect
                                    instanceId="product-partner"
                                    inputId="product-partner"
                                    options={partnerOptions}
                                    isSearchable
                                    isClearable
                                    placeholder="Search partners"
                                    styles={selectStyles<any>()}
                                    menuPortalTarget={menuPortalTarget}
                                    onChange={(e) => setAssignedPartners(e as PartnerProps)}
                                    value={assignedPartners.idUsers ? (assignedPartners as any) : null}
                                />
                            </Field>
                            <Field label={<>Packing<Required /></>} hint={packingList.length ? undefined : 'Add a packing first.'}>
                                <ReactSelect
                                    instanceId="product-packing"
                                    inputId="product-packing"
                                    options={packingOptions}
                                    isSearchable
                                    isClearable
                                    placeholder="Choose a packing"
                                    styles={selectStyles<any>()}
                                    menuPortalTarget={menuPortalTarget}
                                    onChange={(e) => setSelectedPacking(e as PackingProps)}
                                    value={selectedPacking.idProductPackings ? (selectedPacking as any) : null}
                                />
                            </Field>
                            <Field label={<>Sell rate (৳)<Required /></>}>
                                <Input type="number" placeholder="e.g. 120" name="sellRate" onChange={(e) => setSellRate(parseInt(e.target.value))} value={sellRate ? sellRate : ''} />
                            </Field>
                            <Button variant="primary" className="tw-w-full" disabled={loading} onClick={handlePartnerAssign}>
                                {loading ? <Loader2 className="tw-h-4 tw-w-4 tw-animate-spin" aria-hidden /> : <UserPlus className="tw-h-4 tw-w-4" aria-hidden />}
                                Assign partner
                            </Button>
                        </div>
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
