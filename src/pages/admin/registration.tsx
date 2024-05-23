import React, { useState } from 'react';
import { Button, Col, Container, Form, Row } from 'react-bootstrap';
import { API_URL } from '@/config/constants';
import MainLayout from '@/layouts/MainLayout';

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
        try {
            const res = await fetch(API_URL + 'api/admin_registration', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const data = await res.json();
            if (res.status === 200) {
                setFormData({
                    name: '',
                    email: '',
                    phoneNumber: 0
                });
            } else {
                console.log('Registration failed');
            }

        } catch (err) {
            console.log(err);
        }
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
                                <Form.Control type="text" placeholder="Enter your full name" name="name" onChange={handleOnChange} value={formData.name} required />
                            </Col>
                        </Form.Group>
                        <Form.Group as={Row}>
                            <Form.Label column md='4' className='mb-3'>Email <span className='text-danger'>*</span></Form.Label>
                            <Col md='8'>
                                <Form.Control type="email" placeholder="Enter your email" name="email" onChange={handleOnChange} value={formData.email} required />
                            </Col>
                        </Form.Group>
                        <Form.Group as={Row}>
                            <Form.Label column md='4' className='mb-3'>Phone Number <span className='text-danger'>*</span></Form.Label>
                            <Col md='8'>
                                <Form.Control type="number" placeholder="Enter your phone number" name="phoneNumber" onChange={handleOnChange} value={formData.phoneNumber} required />
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