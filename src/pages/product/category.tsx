import React, { useState, useEffect } from 'react';
import { Button, Col, Container, Form, InputGroup, Row, Table } from 'react-bootstrap';
import { API_URL } from '@/config/constants';
import MainLayout from '@/layouts/MainLayout';
import { getRequestOptions, postRequestOptions } from '@/utils/Fetch';
import Swal from 'sweetalert2';
import { getCookie } from '@/utils/GetCookie';

interface FormDataType {
    categoryName: string;
    categoryImage: any;
    status: 'active' | 'inactive';
}


function Category() {
    const [formData, setFormData] = useState<FormDataType>({
        categoryName: '',
        categoryImage: '',
        status: 'active',
    });
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
                newFormData.append('categoryName', formData.categoryName);
                newFormData.append('status', formData.status);
                newFormData.append('categoryImage', formData.categoryImage);

                try {
                    const fetchData = async () => {
                        const res = await fetch(API_URL + 'api/product-category/create', {
                            method: 'POST',
                            headers: { 'Authorization': 'Bearer ' + getCookie('saathi-token') },
                            body: newFormData,
                        });
                        if (res.status === 200) {
                            Swal.fire({
                                icon: 'success',
                                title: 'Success',
                                text: 'Product category created successfully!',
                            });
                            setFormData({
                                categoryName: '',
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
                <Row className="justify-content-center">
                    <Col md={6}>
                        <h2 className="text-center">Product Category</h2>
                        <hr />
                        <Form onSubmit={handleSubmit}>
                            <Form.Group as={Row}>
                                <Form.Label column sm='4' className='mb-3'>Category Name<span className='text-danger'>*</span></Form.Label>
                                <Col sm='8'>
                                    <Form.Control type="text" placeholder="Enter category name" name="categoryName" onChange={handleOnChange} value={formData.categoryName} />
                                </Col>
                            </Form.Group>
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
                </Row>
            </Container>

            {/* <Container className='mt-5'>
                <h2 className="text-center">Investment Setup List</h2>
                <hr />
                <Table responsive striped bordered hover>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Plan Name</th>
                            <th>Investment Type</th>
                            <th>Return Type</th>
                            <th>Return</th>
                            <th>Tenure</th>
                        </tr>
                    </thead>
                    <tbody>
                        {investmentList.length > 0 ? investmentList.map((investment, index) => (
                            <tr key={index}>
                                <td>{index + 1}</td>
                                <td>{investment.planName}</td>
                                <td>{investment.investmentType.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}</td>
                                <td>{investment.returnType}</td>
                                <td>{investment.minimumReturn}% - {investment.maximumReturn}%</td>
                                <td>{investment.duration} {investment.tenure}</td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={6} className="text-center">No investment setup found</td>
                            </tr>
                        )}

                    </tbody>
                </Table>
            </Container> */}
            <pre>{JSON.stringify(formData, null, 2)}</pre>
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