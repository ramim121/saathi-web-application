import React, { useState, useEffect } from 'react';
import { Button, Col, Container, Form, InputGroup, Row, Table, Spinner } from 'react-bootstrap';
import { API_URL } from '@/config/constants';
import MainLayout from '@/layouts/MainLayout';
import { getRequestOptions, postRequestOptions } from '@/utils/Fetch';
import Swal from 'sweetalert2';

interface FormDataType {
    idInvestmentSetup?: number,
    nameOfThePlan?: string,
    investmentType: string,
    returnType: string,
    minimumReturn: number,
    maximumReturn: number,
    duration: number,
    tenure: string,
    planName?: string,
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

    const [investmentList, setInvestmentList] = useState<FormDataType[]>([]);
    const [reload, setReload] = useState<boolean>(true);
    const [loading, setLoading] = useState<boolean>(false);

    const handleOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    }

    const handleInvestmentTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setFormData({ ...formData, investmentType: e.target.value });
    }

    const minimumReturnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (formData.returnType === 'fixed') {
            setFormData({ ...formData, minimumReturn: Number(e.target.value), maximumReturn: Number(e.target.value) });
        } else {
            setFormData({ ...formData, minimumReturn: Number(e.target.value) });
        }
    }

    const handleTenureChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setFormData({ ...formData, tenure: e.target.value });
    }

    const handleReturnTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setFormData({ ...formData, returnType: e.target.value, maximumReturn: formData.minimumReturn });
    }

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        Swal.fire({
            title: 'Are you sure?',
            text: "You want to setup this investment!",
            icon: 'warning',
            showCancelButton: true,
            cancelButtonText: 'No',
            confirmButtonText: 'Yes'
        }).then(async (result) => {
            if (result.value) {
                try {
                    // Proceed with the API request
                    const res = await fetch(API_URL + 'api/investments/create', postRequestOptions(formData));

                    if (res.status === 200) {
                        Swal.fire({
                            icon: 'success',
                            title: 'Success',
                            text: 'Investment setup successful!',
                        });
                        // Reset form and reload the investment list
                        setFormData({
                            nameOfThePlan: '',
                            investmentType: '',
                            returnType: 'variable',
                            minimumReturn: 0,
                            maximumReturn: 0,
                            duration: 0,
                            tenure: 'months',
                        });
                        setReload(true);
                    } else {
                        Swal.fire({
                            icon: 'error',
                            title: 'Error',
                            html: (await res.json()).message,
                        });
                    }
                } catch (err) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: 'Something went wrong!',
                    });
                } finally {
                    setLoading(false);
                }
            } else {
                setLoading(false);
            }
        });
    }


    useEffect(() => {
        const fetchInvestmentSetupList = async () => {
            try {
                const res = await fetch('/api/investments/list', getRequestOptions());
                const data = await res.json();
                if (res.status === 200) {
                    setInvestmentList(data.data);
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
        if (reload) {
            fetchInvestmentSetupList();
        }
    }, [reload]);


    return (
        <>
            <Container fluid>
                <Row className="justify-content-center">
                    <Col md={6}>
                        <h4 className="text-start">Investment Setup</h4>
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
                                        <option value="sustainable_return">Sustainable Return</option>
                                        <option value="fast_return">Fast Return</option>
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
                                <Form.Label column sm='4' className='mb-3'>{formData.returnType === "fixed" ? "Total " : "Minimum "} Return<span className='text-danger'>*</span></Form.Label>
                                <Col sm='8'>
                                    <InputGroup>
                                        <Form.Control type="number" placeholder="Enter minimum return" name="minimumReturn" onChange={minimumReturnChange} value={formData.minimumReturn} />
                                        <InputGroup.Text>%</InputGroup.Text>
                                    </InputGroup>
                                </Col>
                            </Form.Group>
                            {formData.returnType === 'variable' &&
                                <Form.Group as={Row}>
                                    <Form.Label column sm='4' className='mb-3'>Maximum Return<span className='text-danger'>*</span></Form.Label>
                                    <Col sm='8'>
                                        <InputGroup>
                                            <Form.Control type="number" placeholder="Enter maximum return" name="maximumReturn" onChange={handleOnChange} value={formData.maximumReturn} />
                                            <InputGroup.Text>%</InputGroup.Text>
                                        </InputGroup>
                                    </Col>
                                </Form.Group>
                            }
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

                            <Row>
                                <Col sm='4'></Col>
                                <Col sm='8'>
                                    <Row className='justify-content-center'>
                                        <Button className='w-50' variant="primary" type="submit" disabled={loading}>
                                            {loading && <Spinner as="span" animation="grow" size="sm" role="status" aria-hidden="true" />}
                                            {loading ? 'Submitting...' : 'Submit'}
                                        </Button>
                                    </Row>
                                </Col>
                            </Row>
                        </Form>
                    </Col>
                </Row>
            </Container>

            <Container fluid className='mt-5'>
                <h4 className="text-start">Investment Setup List</h4>
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
            </Container>

        </>

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