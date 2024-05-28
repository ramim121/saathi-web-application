import React, { useState } from 'react';
import { Button, Col, Container, Form, InputGroup, Row } from 'react-bootstrap';
import { API_URL } from '@/config/constants';
import MainLayout from '@/layouts/MainLayout';
import { postRequestOptions } from '@/utils/Fetch';
import Swal from 'sweetalert2';

interface FormDataType {
    nameOfThePlan: string,
    investmentType: string,
    returnType: string,
    minimumReturn: number,
    maximumReturn: number,
    duration: number,
    tenure: string,
}

function Investment() {
    const [formData, setFormData] = useState<FormDataType>({
        nameOfThePlan: '',
        investmentType: '',
        returnType: 'variable',
        minimumReturn: 0,
        maximumReturn: 0,
        duration: 0,
        tenure: 'months',
    });

    const handleOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    }

    const handleInvestmentTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setFormData({ ...formData, investmentType: e.target.value });
    }

    const handleTenureChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setFormData({ ...formData, tenure: e.target.value });
    }

    const handleReturnTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setFormData({ ...formData, returnType: e.target.value, maximumReturn: formData.minimumReturn });
    }

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        Swal.fire({
            title: 'Are you sure?',
            text: "You want to setup this investment!",
            icon: 'warning',
            showCancelButton: true,
            cancelButtonText: 'No',
            confirmButtonText: 'Yes'
        }).then((result) => {
            if (result.value) {
                try {
                    const fetchData = async () => {
                        const res = await fetch(API_URL + 'api/setup/investment', postRequestOptions(formData));
                        if (res.status === 200) {
                            Swal.fire({
                                icon: 'success',
                                title: 'Success',
                                text: 'Investment setup successfull!',
                            });
                            setFormData({
                                nameOfThePlan: '',
                                investmentType: '',
                                returnType: 'variable',
                                minimumReturn: 0,
                                maximumReturn: 0,
                                duration: 0,
                                tenure: 'months',
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
                    <h2 className="text-center">Investment Setup</h2>
                    <hr />
                    <Form onSubmit={handleSubmit}>
                        <Form.Group as={Row}>
                            <Form.Label column sm='4' className='mb-3'>Name of the plan<span className='text-danger'>*</span></Form.Label>
                            <Col sm='8'>
                                <Form.Control type="text" placeholder="Enter name of the plan" name="nameOfThePlan" onChange={handleOnChange} value={formData.nameOfThePlan} />
                            </Col>
                        </Form.Group>
                        <Form.Group as={Row}>
                            <Form.Label column sm='4' className='mb-3'>Investment Type<span className='text-danger'>*</span></Form.Label>
                            <Col sm='8'>
                                <Form.Select name='investmentType' onChange={handleInvestmentTypeChange} value={formData.investmentType}>
                                    <option>Select investment type</option>
                                    <option value="high_return">High Return</option>
                                    <option value="low_return">Low Return</option>
                                    <option value="short_duration">Short Duration</option>
                                    <option value="long_duration">Long Duration</option>
                                    <option value="shariah">Shariah</option>
                                </Form.Select>
                            </Col>
                        </Form.Group>
                        <Form.Group as={Row}>
                            <Form.Label column sm='4' className='mb-3'>Return Type<span className='text-danger'>*</span></Form.Label>
                            <Col sm='8'>
                                <Form.Select name='returnType' onChange={handleReturnTypeChange} value={formData.returnType}>
                                    <option value="variable">Variable</option>
                                    <option value="fixed">Fixed</option>
                                </Form.Select>
                            </Col>
                        </Form.Group>
                        <Form.Group as={Row}>
                            <Form.Label column sm='4' className='mb-3'>Minimum Return<span className='text-danger'>*</span></Form.Label>
                            <Col sm='8'>
                                <InputGroup>
                                    <Form.Control type="number" placeholder="Enter minimum return" name="minimumReturn" onChange={handleOnChange} value={formData.minimumReturn} />
                                    <InputGroup.Text>%</InputGroup.Text>
                                </InputGroup>
                            </Col>
                        </Form.Group>
                        <Form.Group as={Row}>
                            <Form.Label column sm='4' className='mb-3'>Maximum Return<span className='text-danger'>*</span></Form.Label>
                            <Col sm='8'>
                                <InputGroup>
                                    <Form.Control type="number" placeholder="Enter maximum return" name="maximumReturn" onChange={handleOnChange} value={formData.maximumReturn} disabled={formData.returnType === 'fixed'} />
                                    <InputGroup.Text>%</InputGroup.Text>
                                </InputGroup>
                            </Col>
                        </Form.Group>
                        <Form.Group as={Row}>
                            <Form.Label column sm='4' className='mb-3'>Tenure<span className='text-danger'>*</span></Form.Label>
                            <Col sm='8'>
                                <InputGroup>
                                    <Form.Control type="number" placeholder="Enter duration" name="duration" onChange={handleOnChange} value={formData.duration} />
                                    <Form.Select name='tenure' onChange={handleTenureChange} value={formData.tenure}>
                                        <option value="months">Months</option>
                                        <option value="years">Years</option>
                                    </Form.Select>
                                </InputGroup>
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

export default Investment;

Investment.getLayout = function PageLayout(page: any) {
    return (
        <MainLayout>
            {page}
        </MainLayout>
    )
}