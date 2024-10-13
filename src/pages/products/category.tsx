import React, { useState, useEffect } from 'react';
import { Button, Col, Container, Form, Row, Table, Pagination } from 'react-bootstrap';
import { API_URL } from '@/config/constants';
import MainLayout from '@/layouts/MainLayout';
import { getRequestOptions } from '@/utils/Fetch';
import Swal from 'sweetalert2';
import { getCookie } from '@/utils/GetCookie';
import Image from "next/image";
import { S3_URL } from '@/config/constants';

interface FormDataType {
    idProductCategories?: string;
    productCategoryName: string;
    productCategoryId?: string;
    categoryImage: any;
    status: 'active' | 'inactive';
}

interface FilterProps {
    idProductCategories: string;
    productCategoryName: string;
    productCategoryId: string;
    status: string;
    orderBy: string;
    orderType: string;
    page: number;
    pageSize: number;
}

function Category() {
    const [formData, setFormData] = useState<FormDataType>({
        productCategoryName: '',
        categoryImage: '',
        status: 'active',
    });

    const [filter, setFilter] = useState<FilterProps>({
        idProductCategories: '',
        productCategoryName: '',
        productCategoryId: '',
        status: '',
        orderBy: 'idProductCategories',
        orderType: 'DESC',
        page: 1,
        pageSize: 10
    });
    const [total, setTotal] = useState<number>(0);
    const [totalPages, setTotalPages] = useState<number>(1);

    const [productCategoryList, setProductCategoryList] = useState<FormDataType[]>([]);
    const [reload, setReload] = useState<boolean>(true);

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
        const fetchProductCategoryList = async () => {
            const query = new URLSearchParams(filter as any).toString();
            try {
                const res = await fetch(`/api/product-categories/list?${query}`, getRequestOptions());
                const data = await res.json();
                if (res.status === 200) {
                    setProductCategoryList(data.data);
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
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: err.message,
                });
            }
        }
        fetchProductCategoryList();
    }, [filter, reload]);

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

    const handleEditChange = (product: FormDataType) => () => {
        setFormData({
            idProductCategories: product.idProductCategories,
            productCategoryName: product.productCategoryName,
            productCategoryId: product.productCategoryId,
            categoryImage: product.categoryImage,
            status: product.status,
        });
    }

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        Swal.fire({
            title: 'Are you sure?',
            text: "You want to create this category!",
            icon: 'warning',
            showCancelButton: true,
            cancelButtonText: 'No',
            confirmButtonText: 'Yes'
        }).then((result) => {
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
                    const fetchData = async () => {
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
                            setFormData({
                                productCategoryName: '',
                                categoryImage: '',
                                status: 'active',
                            });
                            setReload(true);

                        } else {
                            Swal.fire({
                                icon: 'error',
                                title: 'Error',
                                html: (await res.json()).message,
                            });
                        }
                    };
                    fetchData();

                } catch (err) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: 'Something went wrong!',
                    });
                }
            }
        });
    };


    return (
        <>
            <Container>
                <Row>
                    <Col md={2}></Col>
                    <Col md={8}>
                        <h2 className="text-center">Product Category</h2>
                        <hr />
                        <Row>
                            <Col md={8}>
                                <Form onSubmit={handleSubmit}>
                                    <Form.Group as={Row}>
                                        <Form.Label column sm='4' className='mb-3'>Category Name<span className='text-danger'>*</span></Form.Label>
                                        <Col sm='8'>
                                            <Form.Control type="text" placeholder="Enter category name" name="productCategoryName" onChange={handleOnChange} value={formData.productCategoryName} />
                                        </Col>
                                    </Form.Group>
                                    {formData.idProductCategories && (
                                        <Form.Group as={Row}>
                                            <Form.Label column sm='4' className='mb-3'>Product Category Id</Form.Label>
                                            <Col sm='8'>
                                                <Form.Control type="text" placeholder="Enter product category id" name="productCategoryId" value={formData.productCategoryId} disabled />
                                            </Col>
                                        </Form.Group>
                                    )}
                                    <Form.Group as={Row}>
                                        <Form.Label column sm='4' className='mb-3'>Category Image<span className='text-danger'>*</span></Form.Label>
                                        <Col sm='8'>
                                            <Form.Control type="file" name="categoryImage" onChange={handleFileUpload} />
                                        </Col>
                                    </Form.Group>
                                    <Form.Group as={Row}>
                                        <Form.Label column sm='4' className='mb-3'>Status<span className='text-danger'>*</span></Form.Label>
                                        <Col sm='8'>
                                            <Form.Select name='status' onChange={handleOnChange} value={formData.status}>
                                                <option value="active">Active</option>
                                                <option value="inactive">Inactive</option>
                                            </Form.Select>
                                        </Col>
                                    </Form.Group>
                                    <Row>
                                        <Col sm='4'></Col>
                                        <Col sm='8'>
                                            <Row className='justify-content-center'>
                                                <Button className='w-50' variant="primary" type="submit">
                                                    Submit
                                                </Button>
                                            </Row>
                                        </Col>
                                    </Row>
                                </Form>
                            </Col>
                            <Col md={4}>
                                {(formData.idProductCategories && typeof (formData.categoryImage) === 'string') ?
                                    <Image src={`${S3_URL}product-category-image/${formData.categoryImage}`} alt={formData.categoryImage} width={200} height={200} />
                                    : formData.categoryImage !== '' &&
                                    <Image
                                        src={URL.createObjectURL(formData.categoryImage)}
                                        alt={formData.categoryImage.name}
                                        width={200}
                                        height={150}
                                    />
                                }
                            </Col>
                        </Row>
                    </Col>
                    <Col md={2}>
                    </Col>

                </Row>
            </Container>

            <Container className='mt-5'>
                <h2 className="text-center">Product Category List</h2>
                <hr />
                <Table responsive striped bordered hover>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Category Name</th>
                            <th>Product Category Id</th>
                            <th>Category Image</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                        <tr>
                            <td>
                                <input type="number" className="form-control form-control-sm" placeholder="Search" name="idProductCategories" onChange={handleInputOnChange} value={filter.idProductCategories} />
                            </td>
                            <td>
                                <input type="text" className="form-control form-control-sm" placeholder="Search" name="productCategoryName" onChange={handleInputOnChange} value={filter.productCategoryName} />
                            </td>
                            <td>
                                <input type="text" className="form-control form-control-sm" placeholder="Search" name="productCategoryId" onChange={handleInputOnChange} value={filter.productCategoryId} />
                            </td>
                            <td>
                            </td>
                            <td>
                                <input type="text" className="form-control form-control-sm" placeholder="Search" name="status" onChange={handleInputOnChange} value={filter.status} />
                            </td>
                            <td></td>

                        </tr>
                    </thead>
                    <tbody>
                        {productCategoryList.length > 0 ? productCategoryList.map((product, index) => (
                            <tr key={index}>
                                <td>{product.idProductCategories}</td>
                                <td>{product.productCategoryName}</td>
                                <td>{product.productCategoryId}</td>
                                <td>
                                    {product.categoryImage && <Image src={`${S3_URL}product-category-image/${product.categoryImage}`} alt={product.categoryImage} width={100} height={100} />}

                                </td>
                                <td>{product.status.charAt(0).toUpperCase() + product.status.slice(1)}</td>
                                <td>
                                    <Button variant="primary" size="sm" onClick={handleEditChange(product)}>Edit</Button>
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={6} className="text-center">No Product Category found</td>
                            </tr>
                        )}

                    </tbody>
                </Table>
                <Pagination>
                    <Pagination.First onClick={() => handlePageChange(1)} disabled={filter.page === 1} />
                    <Pagination.Prev onClick={() => handlePageChange(filter.page - 1)} disabled={filter.page === 1} />
                    {pageList()}
                    <Pagination.Next onClick={() => handlePageChange(filter.page + 1)} disabled={filter.page === totalPages} />
                    <Pagination.Last onClick={() => handlePageChange(totalPages)} disabled={filter.page === totalPages} />
                </Pagination>
            </Container>
            {/* <pre>{JSON.stringify(formData, null, 2)}</pre> */}
        </>

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