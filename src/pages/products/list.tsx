import React, { useState, useEffect } from "react";
import Link from "next/link";
import MainLayout from "@/layouts/MainLayout";
import { getRequestOptions } from "@/utils/Fetch";
import Swal from "sweetalert2";
import { ChevronRight, Package, Plus, Tags, X } from "lucide-react";
import { cx } from "@/ui/primitives";
import { Button, Field, Input, LinkButton, SearchInput } from "@/ui/controls";
import { EmptyRow, PageHeader, Pager, TableCard, TD, TH, TR } from "@/ui/layout";

interface ListProps {
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
    }
}

interface FilterProps {
    idProducts: string,
    productName: string,
    productCategory: string,
    unit: string,
    productDescription: string,
    orderBy: string,
    orderType: string,
    page: number,
    pageSize: number
}

const INITIAL_FILTER: FilterProps = {
    idProducts: '',
    productName: '',
    productCategory: '',
    unit: '',
    productDescription: '',
    orderBy: 'idProducts',
    orderType: 'DESC',
    page: 1,
    pageSize: 10
};

function List() {
    const [productList, setProductList] = useState<ListProps[]>([]);
    const [filter, setFilter] = useState<FilterProps>(INITIAL_FILTER);
    const [total, setTotal] = useState<number>(0);
    const [totalPages, setTotalPages] = useState<number>(1);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        const fetchProductList = async () => {
            const query = new URLSearchParams(filter as any).toString();
            setLoading(true);
            try {
                const res = await fetch(`/api/products/list?${query}`, getRequestOptions());
                const data = await res.json();
                if (res.status === 200) {
                    setProductList(data.data);
                    setTotal(data.total);
                    setTotalPages(data.totalPages);
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
            } finally {
                setLoading(false);
            }
        }
        fetchProductList();
    }, [filter]);

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

    const anyFilter = Boolean(filter.idProducts || filter.productName || filter.productCategory || filter.unit || filter.productDescription);

    return (
        <div className="ui">
            <PageHeader
                eyebrow="Shathi Mart"
                title="Products"
                description="What the Mart sells. Open a product to add photos, packings and the partners who supply it."
                actions={
                    <>
                        <LinkButton href="/products/category">
                            <Tags className="tw-h-4 tw-w-4" aria-hidden /> Categories
                        </LinkButton>
                        <LinkButton href="/products/create" variant="primary">
                            <Plus className="tw-h-4 tw-w-4" aria-hidden /> New product
                        </LinkButton>
                    </>
                }
            />

            <TableCard
                toolbar={
                    <div className="tw-flex tw-flex-col tw-gap-3">
                        <div className="tw-grid tw-grid-cols-2 tw-gap-3 lg:tw-grid-cols-[2fr_1.2fr_1fr_1.4fr_0.7fr_auto]">
                            <Field label="Product" className="tw-col-span-2 lg:tw-col-span-1">
                                <SearchInput placeholder="Search by name" name="productName" value={filter.productName} onChange={handleInputOnChange} />
                            </Field>
                            <Field label="Category">
                                <Input placeholder="Any" name="productCategory" value={filter.productCategory} onChange={handleInputOnChange} />
                            </Field>
                            <Field label="Unit">
                                <Input placeholder="Any" name="unit" value={filter.unit} onChange={handleInputOnChange} />
                            </Field>
                            <Field label="Description">
                                <Input placeholder="Any words" name="productDescription" value={filter.productDescription} onChange={handleInputOnChange} />
                            </Field>
                            <Field label="#">
                                <Input placeholder="ID" name="idProducts" value={filter.idProducts} onChange={handleInputOnChange} />
                            </Field>
                            <div className="tw-flex tw-items-end">
                                {anyFilter && (
                                    <Button variant="ghost" onClick={() => setFilter({ ...INITIAL_FILTER, pageSize: filter.pageSize })}>
                                        <X className="tw-h-4 tw-w-4" aria-hidden /> Clear
                                    </Button>
                                )}
                            </div>
                        </div>
                        <p className="tw-text-xs tw-tabular-nums tw-text-slate-500">{loading ? 'Loading…' : `${Number(total || 0).toLocaleString('en-IN')} products`}</p>
                    </div>
                }
                footer={<Pager page={filter.page} totalPages={pages} onChange={handlePageChange} summary={total ? `Page ${filter.page} of ${pages}` : undefined} />}
            >
                <thead>
                    <tr>
                        <th className={cx(TH, 'tw-min-w-[16rem]')}>Product</th>
                        <th className={TH}>Category</th>
                        <th className={TH}>Unit</th>
                        <th className={cx(TH, 'tw-text-right')}>
                            <span className="tw-sr-only">Open</span>
                        </th>
                    </tr>
                </thead>
                <tbody className={cx(loading && 'tw-opacity-60 tw-transition-opacity')}>
                    {productList.length > 0 ? productList.map((product) => (
                        <tr key={product.idProducts} className={TR}>
                            <td className={TD}>
                                <div className="tw-flex tw-items-start tw-gap-3">
                                    <span className="tw-flex tw-h-9 tw-w-9 tw-shrink-0 tw-items-center tw-justify-center tw-rounded-xl tw-bg-brand-50 tw-text-brand-700">
                                        <Package className="tw-h-4 tw-w-4" aria-hidden />
                                    </span>
                                    <div className="tw-min-w-0">
                                        <Link href={`/products/details/${product.idProducts}`} className="tw-font-medium tw-text-slate-900 hover:tw-text-brand-700">
                                            {product.productName}
                                        </Link>
                                        <div className="tw-text-xs tw-text-slate-400">#{product.idProducts}</div>
                                        {product.productDescription && <p className="tw-mt-0.5 tw-line-clamp-2 tw-max-w-xl tw-text-xs tw-text-slate-500">{product.productDescription}</p>}
                                    </div>
                                </div>
                            </td>
                            <td className={cx(TD, 'tw-whitespace-nowrap tw-text-slate-700')}>{product.ProductCategory?.productCategoryName || '—'}</td>
                            <td className={cx(TD, 'tw-whitespace-nowrap tw-text-slate-600')}>{product.Unit?.unitName || '—'}</td>
                            <td className={cx(TD, 'tw-text-right')}>
                                <Link
                                    href={`/products/details/${product.idProducts}`}
                                    className="tw-inline-flex tw-h-8 tw-w-8 tw-items-center tw-justify-center tw-rounded-lg tw-text-slate-400 hover:tw-bg-slate-100 hover:tw-text-slate-700"
                                    aria-label={`Open ${product.productName}`}
                                >
                                    <ChevronRight className="tw-h-4 tw-w-4" aria-hidden />
                                </Link>
                            </td>
                        </tr>
                    )) : (
                        <EmptyRow colSpan={4} title={loading ? 'Loading products…' : 'No products match'} hint={!loading && anyFilter ? 'Try fewer filters.' : undefined} />
                    )}
                </tbody>
            </TableCard>
        </div>
    )
}

export default List;

List.getLayout = function PageLayout(page: any) {
    return (
        <MainLayout>
            {page}
        </MainLayout>
    )
}
