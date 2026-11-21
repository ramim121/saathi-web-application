import React, { useState, useEffect } from "react";
import Link from "next/link";
import MainLayout from "@/layouts/MainLayout";
import { getRequestOptions } from "@/utils/Fetch";
import Swal from "sweetalert2";
import { ChevronRight, Package, Plus, Tags } from "lucide-react";
import { cx } from "@/ui/primitives";
import { Field, Input, LinkButton } from "@/ui/controls";
import { EmptyRow, PageHeader, TableCard, TD, TH, TR } from "@/ui/layout";
import { ListFooter, ListToolbar, SortTH, filterChips, useListState } from "@/ui/table";

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

const DEFAULTS = {
    q: '',
    productCategory: '',
    unit: '',
    orderBy: 'idProducts',
    orderType: 'DESC' as 'ASC' | 'DESC',
    page: 1,
    pageSize: 25,
};

/**
 * Products: one search box (name, description or product number), category and
 * unit filters with chips, sortable names, rows per page; the view is kept in
 * the URL.
 */
function List() {
    const list = useListState(DEFAULTS);
    const { state, update } = list;
    const [productList, setProductList] = useState<ListProps[]>([]);
    const [total, setTotal] = useState<number>(0);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        if (!list.ready) return;
        let live = true;
        const fetchProductList = async () => {
            setLoading(true);
            try {
                const res = await fetch(`/api/products/list?${list.query}`, getRequestOptions());
                const data = await res.json();
                if (!live) return;
                if (res.status === 200) {
                    setProductList(data.data);
                    setTotal(Number(data.total) || 0);
                } else {
                    Swal.fire({ icon: 'error', title: 'Error', text: data.message });
                }
            } catch (err: any) {
                if (live) Swal.fire({ icon: 'error', title: 'Error', text: err.message });
            } finally {
                if (live) setLoading(false);
            }
        }
        fetchProductList();
        return () => {
            live = false;
        };
    }, [list.query, list.ready]);

    const chips = filterChips(state, list.defaults, { productCategory: 'Category', unit: 'Unit' }, update);
    const anyFilter = chips.length > 0 || state.q !== '';

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
                    <ListToolbar
                        search={state.q}
                        onSearch={(q) => update({ q }, { typing: true })}
                        placeholder="Product name, description or #"
                        chips={chips}
                        onReset={() => list.reset()}
                        filters={
                            <>
                                <Field label="Category">
                                    <Input placeholder="Any part of the name" {...list.bind('productCategory')} />
                                </Field>
                                <Field label="Unit">
                                    <Input placeholder="e.g. kg" {...list.bind('unit')} />
                                </Field>
                            </>
                        }
                    />
                }
                footer={<ListFooter page={state.page} pageSize={state.pageSize} total={total} loading={loading} noun="products" onPage={(page) => update({ page })} onPageSize={(pageSize) => update({ pageSize })} />}
            >
                <thead>
                    <tr>
                        <SortTH label="Product" field="productName" sort={state} onSort={list.sortBy} className="tw-min-w-[16rem]" />
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
