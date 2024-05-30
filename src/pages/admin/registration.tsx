import React, { useState } from 'react';
import { Button, Col, Container, Form, Row } from 'react-bootstrap';
import { API_URL } from '@/config/constants';
import MainLayout from '@/layouts/MainLayout';
import Swal from 'sweetalert2';
import { postRequestOptions } from '@/utils/Fetch';

interface FormDataType {
    name: string,
    email: string,
    phoneNumber: number
}

function Registration() {
    const [formData, setFormData] = useState<FormDataType>({
        name: '',
        email: '',
        phoneNumber: 0
    });

    const handleOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    }

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        Swal.fire({
            title: 'Are you sure?',
            text: "You want to register!",
            icon: 'warning',
            showCancelButton: true,
            cancelButtonText: 'No',
            confirmButtonText: 'Yes'
        }).then((result) => {
            if (result.value) {
                try {
                    const fetchData = async () => {
                        const res = await fetch(API_URL + 'api/admin_registration', postRequestOptions(formData));
                        if (res.status === 200) {
                            Swal.fire({
                                icon: 'success',
                                title: 'Success',
                                text: 'Admin registration successfull!',
                            });
                            setFormData({
                                name: '',
                                email: '',
                                phoneNumber: 0
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
        <Container>
            <Row className="justify-content-center">
                <Col md={6}>
                    <h2 className="text-center mt-2">Admin Registration</h2>
                    <hr />
                    <Form onSubmit={handleSubmit}>
                        <Form.Group as={Row}>
                            <Form.Label column md='4' className='mb-3'>Name <span className='text-danger'>*</span></Form.Label>
                            <Col md='8'>
                                <Form.Control type="text" placeholder="Enter your full name" name="name" onChange={handleOnChange} value={formData.name} />
                            </Col>
                        </Form.Group>
                        <Form.Group as={Row}>
                            <Form.Label column md='4' className='mb-3'>Email <span className='text-danger'>*</span></Form.Label>
                            <Col md='8'>
                                <Form.Control type="email" placeholder="Enter your email" name="email" onChange={handleOnChange} value={formData.email} />
                            </Col>
                        </Form.Group>
                        <Form.Group as={Row}>
                            <Form.Label column md='4' className='mb-3'>Phone Number <span className='text-danger'>*</span></Form.Label>
                            <Col md='8'>
                                <Form.Control type="number" placeholder="Enter your phone number" name="phoneNumber" onChange={handleOnChange} value={formData.phoneNumber} />
                            </Col>
                        </Form.Group>
                        <Button className='w-100 my-2' variant="primary" type="submit">
                            Submit
                        </Button>
                    </Form>
                </Col>
            </Row>
        </Container>
    );
}

export default Registration;

Registration.getLayout = function PageLayout(page: any) {
    return (
        <MainLayout>
            {page}
        </MainLayout>
    )
}