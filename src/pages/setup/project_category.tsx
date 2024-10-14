import React, { useState, useEffect } from "react";
import MainLayout from "@/layouts/MainLayout";
import { Button, Col, Container, Form, Pagination, Row, Table } from "react-bootstrap";
import Swal from 'sweetalert2';
import { API_URL } from '@/config/constants';
import { getCookie } from '@/utils/GetCookie';
import { getRequestOptions } from '@/utils/Fetch';
import Image from "next/image";
import { S3_URL } from '@/config/constants';

interface FormDataType {
    idProjectCategories?: number
    categoryName: string
    categoryImage: File | null
}

interface FilterProps {
    idProjectCategories: string
    categoryName: string
    orderBy: string
    orderType: string
    page: number
    pageSize: number
}

function ProjectCategory() {

    const [formData, setFormData] = useState<FormDataType>({
        categoryName: '',
        categoryImage: null
    });

    const [filter, setFilter] = useState<FilterProps>({
        idProjectCategories: '',
        categoryName: '',
        orderBy: 'idProjectCategories',
        orderType: 'ASC',
        page: 1,
        pageSize: 10
    });


    const [total, setTotal] = useState<number>(0);
    const [totalPages, setTotalPages] = useState<number>(1);
    const [projectCategories, setProjectCategories] = useState<FormDataType[]>([]);
    const [reload, setReload] = useState<boolean>(true);

    useEffect(() => {
        const fetchProjectCategoryList = async () => {
            const query = new URLSearchParams(filter as any).toString();
            try {
                const res = await fetch(`/api/project-categories/list?${query}`, getRequestOptions());
                const data = await res.json();
                if (res.status === 200) {
                    setProjectCategories(data.data);
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
        fetchProjectCategoryList();
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

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        Swal.fire({
            title: 'Are you sure?',
            text: "You want to create this project category!",
            icon: 'warning',
            showCancelButton: true,
            cancelButtonText: 'No',
            confirmButtonText: 'Yes'
        }).then((result) => {
            if (result.value) {
                const newFormData = new FormData();
                newFormData.append('categoryName', formData.categoryName);

                if (formData.categoryImage !== null) {
                    newFormData.append('categoryImage', formData.categoryImage);
                }

                try {
                    const fetchData = async () => {
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
                            setReload(true);
                            setFormData({
                                categoryName: '',
                                categoryImage: null
                            });

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
    }

    return (
        <>
            <Container>
                <Row className="justify-content-center">
                    <Col md={6}>
                        <h4 className="text-start">Project Category</h4>
                        <hr />
                        <Form onSubmit={handleSubmit}>
                            <Form.Group as={Row}>
                                <Form.Label column sm='4' className='mb-3'>Category Name<span className='text-danger'>*</span></Form.Label>
                                <Col sm='8'>
                                    <Form.Control type="text" name="categoryName" value={formData.categoryName} onChange={(e) => setFormData({ ...formData, categoryName: e.target.value })} required />
                                </Col>
                            </Form.Group>
                            <Form.Group as={Row}>
                                <Form.Label column sm='4' className="mb-3">Category Image</Form.Label>
                                <Col sm='8'>
                                    <Form.Control type="file" name="categoryImage" onChange={handleFileUpload} />
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
                </Row>
            </Container>


            <Container className='mt-5'>
                <h4 className="text-start">Project Category List</h4>
                <hr />
                <Table responsive striped bordered hover>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Category Name</th>
                            <th>Category Image</th>
                            {/* <th>Actions</th> */}
                        </tr>
                        <tr>
                            <td>
                                <input type="number" className="form-control form-control-sm" placeholder="Search" name="idProjectCategories" onChange={handleInputOnChange} value={filter.idProjectCategories} />
                            </td>
                            <td>
                                <input type="text" className="form-control form-control-sm" placeholder="Search" name="categoryName" onChange={handleInputOnChange} value={filter.categoryName} />
                            </td>
                            <td></td>
                            {/* <td></td> */}

                        </tr>
                    </thead>
                    <tbody>
                        {projectCategories.length > 0 ? projectCategories.map((project, index) => (
                            <tr key={index}>
                                <td>{project.idProjectCategories}</td>
                                <td>{project.categoryName}</td>
                                <td>
                                    {project.categoryImage && <Image src={`${S3_URL}project-category-image/${project.categoryImage}`} alt={project.categoryName} width={100} height={100} />}

                                </td>
                                {/* <td>
                                    <Button variant="primary" size="sm" onClick={handleEditChange(project)}>Edit</Button>
                                </td> */}
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={3} className="text-center">No Project Category found</td>
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
        </>
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