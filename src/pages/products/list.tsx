import React, { useState, useEffect } from "react";
import MainLayout from "@/layouts/MainLayout";
import { Container, Table, Button, Pagination } from "react-bootstrap";
import { getRequestOptions } from "@/utils/Fetch";
import Link from "next/link";
import Swal from "sweetalert2";

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

function List() {
    const [productList, setProductList] = useState<ListProps[]>([]);
    const [filter, setFilter] = useState<FilterProps>({
        idProducts: '',
        productName: '',
        productCategory: '',
        unit: '',
        productDescription: '',
        orderBy: 'idProducts',
        orderType: 'DESC',
        page: 1,
        pageSize: 10

    });
    const [total, setTotal] = useState<number>(0);
    const [totalPages, setTotalPages] = useState<number>(1);

    useEffect(() => {
        const fetchProductList = async () => {
            const query = new URLSearchParams(filter as any).toString();
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
            }
        }
        fetchProductList();
    }, [filter]);

    const handleInputOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFilter({
            ...filter,
            [name]: value
        });
    }

    const pagesNumber = () => {
        if (total === 0) {
            return [];
        }
        let from = Number(filter.page) - 4;
        if (from < 1) {
            from = 1;
        }
        let to = from + 4 * 2
        if (to >= Math.ceil(total / 10)) {
            to = Math.ceil(total / 10)
        }
        let pagesArray = []

        for (let page = from; page <= to; page++) {
            pagesArray.push(page)
        }
        return pagesArray
    }

    const pageList = () => {
        return pagesNumber().map((pageNumber) => {
            return (
                <Pagination.Item key={pageNumber} active={pageNumber === filter.page} onClick={() => handlePageChange(pageNumber)}>
                    {pageNumber}
                </Pagination.Item>
            )
        })
    }

    const handlePageChange = (page: number) => {
        setFilter({
            ...filter,
            page: page
        })
    }


    return (
        <Container>
            <h4 className="text-start">Products List</h4>
            <hr />
            <Table responsive striped bordered hover size="sm">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Product Name</th>
                        <th>Category</th>
                        <th>Unit</th>
                        <th>Description</th>
                        <th>Actions</th>
                    </tr>
                    <tr>
                        <td>
                            <input type="text" name="idProducts" value={filter.idProducts} onChange={handleInputOnChange} className="form-control form-control-sm" />
                        </td>
                        <td>
                            <input type="text" name="productName" value={filter.productName} onChange={handleInputOnChange} className="form-control form-control-sm" />
                        </td>
                        <td>
                            <input type="text" name="productCategory" value={filter.productCategory} onChange={handleInputOnChange} className="form-control form-control-sm" />
                        </td>
                        <td>
                            <input type="text" name="unit" value={filter.unit} onChange={handleInputOnChange} className="form-control form-control-sm" />
                        </td>
                        <td>
                            <input type="text" name="productDescription" value={filter.productDescription} onChange={handleInputOnChange} className="form-control form-control-sm" />
                        </td>
                        <td></td>
                    </tr>
                </thead>
                <tbody>
                    {productList.length > 0 ? productList.map((product, index) => (
                        <tr key={index}>
                            <td>{product.idProducts}</td>
                            <td>{product.productName}</td>
                            <td>{product.ProductCategory?.productCategoryName}</td>
                            <td>{product.Unit?.unitName}</td>
                            <td>{product.productDescription}</td>
                            <td style={{ whiteSpace: 'nowrap' }}>
                                <Link href={`/products/details/${product.idProducts}`}>
                                    <Button size="sm" variant="primary" className="me-2">Details</Button>
                                </Link>
                            </td>
                        </tr>
                    )) : (
                        <tr>
                            <td colSpan={6} className="text-center">No product found</td>
                        </tr>
                    )}

                </tbody>
                <tfoot>
                    <tr>
                        <td className="pt-2 border-0" colSpan={15}>
                            <div className="d-flex w-100 justify-content-center">
                                <Pagination>
                                    <Pagination.First onClick={() => handlePageChange(1)} disabled={filter.page === 1} />
                                    <Pagination.Prev onClick={() => handlePageChange(filter.page - 1)} disabled={filter.page === 1} />
                                    {pageList()}
                                    <Pagination.Next onClick={() => handlePageChange(filter.page + 1)} disabled={filter.page === totalPages} />
                                    <Pagination.Last onClick={() => handlePageChange(totalPages)} disabled={filter.page === totalPages} />
                                </Pagination>
                            </div>
                        </td>
                    </tr>
                </tfoot>
            </Table>
        </Container>
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