import React, { useState } from 'react';
import { Button, Col, Container, Form, InputGroup, Row } from 'react-bootstrap';
import { API_URL } from '@/config/constants';
import MainLayout from '@/layouts/MainLayout';

interface FormDataType {
    nameOfThePlan: string,
    type: string,
    minimumReturn: number,
    maximumReturn: number,
    duration: number,
    tenure: string,
}

function Investment() {
    const [formData, setFormData] = useState<FormDataType>({
        nameOfThePlan: '',
        type: '',
        minimumReturn: 0,
        maximumReturn: 0,
        duration: 0,
        tenure: 'months',
    });

    const handleOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    }

    const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setFormData({ ...formData, type: e.target.value });
    }

    const handleTenureChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setFormData({ ...formData, tenure: e.target.value });
    }

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        try {
            const res = await fetch(API_URL + 'api/setup/investment', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const data = await res.json();
            if (res.status === 200) {
                setFormData({
                    nameOfThePlan: '',
                    type: '',
                    minimumReturn: 0,
                    maximumReturn: 0,
                    duration: 0,
                    tenure: 'months',
                });
            } else {
                console.log('Investment setup failed');
            }

        } catch (err) {
            console.log(err);
        }
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
                                <Form.Control type="text" placeholder="Enter name of the plan" name="nameOfThePlan" onChange={handleOnChange} required value={formData.nameOfThePlan} />
                            </Col>
                        </Form.Group>
                        <Form.Group as={Row}>
                            <Form.Label column sm='4' className='mb-3'>Type<span className='text-danger'>*</span></Form.Label>
                            <Col sm='8'>
                                <Form.Select name='type' onChange={handleTypeChange} value={formData.type}>
                                    <option>Select investment type</option>
                                    <option value="high">High</option>
                                    <option value="low">Low</option>
                                    <option value="short_duration">Short Duration</option>
                                    <option value="long_duration">Long Duration</option>
                                </Form.Select>
                            </Col>
                        </Form.Group>
                        <Form.Group as={Row}>
                            <Form.Label column sm='4' className='mb-3'>Minimum Return<span className='text-danger'>*</span></Form.Label>
                            <Col sm='8'>
                                <InputGroup>
                                    <Form.Control type="number" placeholder="Enter minimum return" name="minimumReturn" onChange={handleOnChange} required value={formData.minimumReturn} />
                                    <InputGroup.Text>%</InputGroup.Text>
                                </InputGroup>
                            </Col>
                        </Form.Group>
                        <Form.Group as={Row}>
                            <Form.Label column sm='4' className='mb-3'>Maximum Return<span className='text-danger'>*</span></Form.Label>
                            <Col sm='8'>
                                <InputGroup>
                                    <Form.Control type="number" placeholder="Enter maximum return" name="maximumReturn" onChange={handleOnChange} required value={formData.maximumReturn} />
                                    <InputGroup.Text>%</InputGroup.Text>
                                </InputGroup>
                            </Col>
                        </Form.Group>
                        <Form.Group as={Row}>
                            <Form.Label column sm='4' className='mb-3'>Tenure<span className='text-danger'>*</span></Form.Label>
                            <Col sm='8'>
                                <InputGroup>
                                    <Form.Control type="number" placeholder="Enter duration" name="duration" onChange={handleOnChange} required value={formData.duration} />
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