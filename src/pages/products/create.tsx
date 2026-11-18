import React, { useState, useEffect } from 'react';
import MainLayout from '@/layouts/MainLayout';
import { API_URL } from '@/config/public';
import Swal from 'sweetalert2';
import { useRouter } from 'next/router';
import { postRequestOptions } from "@/utils/Fetch";
import { Loader2 } from 'lucide-react';
import { Card } from '@/ui/primitives';
import { Button, Field, Input, LinkButton, Required, Select, Textarea } from '@/ui/controls';
import { PageHeader } from '@/ui/layout';

interface FormDataType {
    productName: string;
    idProductCategories: string;
    idUnit: string;
    productDescription: string;
}

interface ProductCategoryType {
    idProductCategories: number;
    productCategoryName: string;
    productCategoryId: string;
}

interface UnitType {
    idUnit: number;
    unitName: string;
    unitCode: string;
}

function ProductCreate() {
    const router = useRouter();
    const [formData, setFormData] = useState<FormDataType>({
        productName: '',
        idProductCategories: '',
        idUnit: '',
        productDescription: '',
    });
    const [productCategories, setProductCategories] = useState<ProductCategoryType[]>([]);
    const [units, setUnits] = useState<UnitType[]>([]);
    const [loading, setLoading] = useState<boolean>(false);

    useEffect(() => {
        fetchProductCategory();
        fetchUnit();
    }, []);

    const fetchProductCategory = async () => {
        try {
            const res = await fetch(API_URL + 'api/product-categories/get_all_categories');
            const data = await res.json();
            if (res.status === 200) {
                setProductCategories(data.data);
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

    const fetchUnit = async () => {
        try {
            const res = await fetch(API_URL + 'api/unit/get_all_unit');
            const data = await res.json();
            if (res.status === 200) {
                setUnits(data.data);
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

    const handleOnChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData({
            ...formData,
            [name]: value
        });
    }

    /* The pickers used to hand over the numeric id; kept, so the payload is unchanged. */
    const handleProductCategoryChange = (value: string) => {
        setFormData({
            ...formData,
            idProductCategories: (value ? Number(value) : '') as any
        });
    }

    const handleUnitChange = (value: string) => {
        setFormData({
            ...formData,
            idUnit: (value ? Number(value) : '') as any
        });
    }

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        Swal.fire({
            title: 'Are you sure?',
            text: "You want to create this product!",
            icon: 'warning',
            showCancelButton: true,
            cancelButtonText: 'No',
            confirmButtonText: 'Yes'
        }).then(async (result) => {
            if (result.value) {
                try {
                    const res = await fetch(API_URL + 'api/products/create', postRequestOptions(formData));
                    if (res.status === 200) {
                        Swal.fire({
                            icon: 'success',
                            title: 'Success',
                            text: 'Product created successfully!',
                        });
                        router.push('/products/details/' + (await res.json()).data.idProducts);
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
        <div className="ui">
            <PageHeader
                eyebrow="Shathi Mart"
                title="New product"
                description="Name it and place it in a category. Photos, packings and supplying partners are added on the product's page afterwards."
            />
            <Card className="tw-max-w-2xl tw-p-6">
                <form onSubmit={handleSubmit} className="tw-space-y-4">
                    <Field label={<>Product name<Required /></>}>
                        <Input type="text" placeholder="e.g. Organic ginger" name="productName" onChange={handleOnChange} value={formData.productName} />
                    </Field>
                    <div className="tw-grid tw-grid-cols-1 tw-gap-4 sm:tw-grid-cols-2">
                        <Field label={<>Category<Required /></>}>
                            <Select value={formData.idProductCategories || ''} onChange={(e) => handleProductCategoryChange(e.target.value)}>
                                <option value="">{productCategories.length ? 'Choose a category' : 'Loading…'}</option>
                                {productCategories.map((category) => (
                                    <option key={category.idProductCategories} value={category.idProductCategories}>
                                        {category.productCategoryName}
                                    </option>
                                ))}
                            </Select>
                        </Field>
                        <Field label={<>Unit<Required /></>}>
                            <Select value={formData.idUnit || ''} onChange={(e) => handleUnitChange(e.target.value)}>
                                <option value="">{units.length ? 'Choose a unit' : 'Loading…'}</option>
                                {units.map((unit) => (
                                    <option key={unit.idUnit} value={unit.idUnit}>
                                        {unit.unitName} ({unit.unitCode})
                                    </option>
                                ))}
                            </Select>
                        </Field>
                    </div>
                    <Field label="Description">
                        <Textarea placeholder="What it is, how it is grown or made" name="productDescription" onChange={handleOnChange} value={formData.productDescription} />
                    </Field>
                    <div className="tw-flex tw-justify-end tw-gap-2 tw-border-t tw-border-slate-100 tw-pt-4">
                        <LinkButton href="/products/list">Cancel</LinkButton>
                        <Button variant="primary" type="submit" disabled={loading}>
                            {loading && <Loader2 className="tw-h-4 tw-w-4 tw-animate-spin" aria-hidden />}
                            {loading ? 'Creating…' : 'Create product'}
                        </Button>
                    </div>
                </form>
            </Card>
        </div>
    )
}

export default ProductCreate;

ProductCreate.getLayout = function PageLayout(page: any) {
    return (
        <MainLayout>
            {page}
        </MainLayout>
    )
}
