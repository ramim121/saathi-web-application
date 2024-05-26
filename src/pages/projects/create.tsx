import React, { useEffect, useState, useRef } from 'react';
import { Button, Col, Container, Form, Row, Card } from 'react-bootstrap';
import { API_URL } from '@/config/constants';
import MainLayout from '@/layouts/MainLayout';
import Select from 'react-select';
import { Editor } from '@tinymce/tinymce-react';

interface FormDataType {
    projectName: string,
    unitInvestmentValue: number,
    investment: {
        label: string,
        value: number,
        duration?: number,
        maximumReturn?: number,
        minimumReturn?: number,
        tenure?: string,
        type?: string
    },
    summary: string,
    location: string
}

interface InvestmentPlan {
    value: number,
    label: string
}

function Projects() {
    const [formData, setFormData] = useState<FormDataType>({
        projectName: '',
        unitInvestmentValue: 0,
        investment: {
            label: 'Select Investment Plan',
            value: 0
        },
        summary: '',
        location: ''
    });
    const [investmentPlans, setInvestmentPlans] = useState<InvestmentPlan[]>([]);
    const editorRef = useRef<any>(null);

    const handleOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    }

    useEffect(() => {
        const fetchInvestmentPlans = async () => {
            try {
                const res = await fetch(API_URL + 'api/investment_plans');
                const data = await res.json();
                if (res.status === 200) {
                    const plans = data.map((plan: any) => {
                        return {
                            value: plan.idInvestmentSetup,
                            label: plan.planName,
                            duration: plan.duration,
                            maximumReturn: plan.maximumReturn,
                            minimumReturn: plan.minimumReturn,
                            tenure: plan.tenure,
                            type: plan.type

                        }
                    });
                    setInvestmentPlans(plans);
                } else {
                    console.log('Failed to fetch investment plans');
                }
            } catch (err) {
                console.log(err);
            }
        }
        fetchInvestmentPlans();
    }, []);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        formData.summary = editorRef.current.getContent();
        try {
            const res = await fetch(API_URL + 'api/projects/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const data = await res.json();
            if (res.status === 200) {
                setFormData({
                    projectName: '',
                    unitInvestmentValue: 0,
                    investment: {
                        label: 'Select Investment Plan',
                        value: 0
                    },
                    summary: '',
                    location: ''
                });
                editorRef.current.setContent('');
            } else {
                console.log('Registration failed');
            }

        } catch (err) {
            console.log(err);
        }
    }

    return (
        <>
            <Container>
                <Row className='justify-content-center'>
                    <Col md={8}>
                        <h2 className="text-center">Project Creation</h2>
                        <hr />
                        <Form onSubmit={handleSubmit}>

                            <Form.Group as={Row} className='mb-3'>
                                <Form.Label column sm='4' >Name of the project <span className='text-danger'>*</span></Form.Label>
                                <Col sm='8'>
                                    <Form.Control type="text" placeholder="Enter name of the project" name="projectName" onChange={handleOnChange} required value={formData.projectName} />
                                </Col>
                            </Form.Group>

                            <Form.Group as={Row} className='mb-3'>
                                <Form.Label column sm='4'>Share / Unit <span className='text-danger'>*</span></Form.Label>
                                <Col sm='8'>
                                    <Form.Control type="number" placeholder="Enter share per unit" name="unitInvestmentValue" onChange={handleOnChange} required value={formData.unitInvestmentValue} />
                                </Col>
                            </Form.Group>
                            <Card className='mb-3'>
                                <Card.Header className='text-center'>Investment Plan</Card.Header>
                                <Card.Body>
                                    <Form.Group as={Row} className='mb-3'>
                                        <Form.Label column sm='4'>Tag Investment Plan <span className='text-danger'>*</span></Form.Label>
                                        <Col sm='8'>
                                            <Select
                                                id="long-value-select"
                                                instanceId="long-value-select"
                                                options={investmentPlans}
                                                value={formData.investment || { label: 'Select investment plan', value: 0 }}
                                                onChange={(value) => setFormData({ ...formData, investment: value ? value : { label: 'Select investment plan', value: 0 } })}
                                                menuPosition='fixed'
                                            />
                                        </Col>
                                    </Form.Group>
                                    <Form.Group as={Row} className='mb-3'>
                                        <Form.Label column sm='4'>Type</Form.Label>
                                        <Col sm='8'>
                                            <Form.Control type="text" placeholder="Investment Type" value={formData.investment.type !== undefined ? formData.investment.type : ''} disabled />
                                        </Col>
                                    </Form.Group>
                                    <Form.Group as={Row} className='mb-3'>
                                        <Form.Label column sm='4'>Return</Form.Label>
                                        <Col sm='8'>
                                            <Row>
                                                <Col sm='5'>
                                                    <Form.Control type="text" placeholder="Minimum Return" value={`${formData.investment.minimumReturn !== undefined ? formData.investment.minimumReturn : 0}%`} disabled />
                                                </Col>
                                                <Col sm='2' className='text-center'>-</Col>
                                                <Col sm='5'>
                                                    <Form.Control type="text" placeholder="Maximum Return" value={`${formData.investment.maximumReturn !== undefined ? formData.investment.maximumReturn : 0}%`} disabled />
                                                </Col>
                                            </Row>
                                        </Col>
                                    </Form.Group>
                                    <Form.Group as={Row} className='mb-3'>
                                        <Form.Label column sm='4'>Tenure / Duration</Form.Label>
                                        <Col sm='8'>
                                            <Form.Control type="text" placeholder="Tenure" value={`${formData.investment.duration !== undefined ? formData.investment.duration : ''} ${formData.investment.tenure !== undefined ? formData.investment.tenure : ''}`} disabled />
                                        </Col>
                                    </Form.Group>
                                </Card.Body>
                            </Card>
                            <Form.Group as={Row} className='mb-3'>
                                <Form.Label column sm='4'>Location <span className='text-danger'>*</span></Form.Label>
                                <Col sm='8'>
                                    <Form.Control type="text" placeholder="Enter project location" name="location" onChange={handleOnChange} value={formData.location} required />
                                </Col>
                            </Form.Group>
                            <Form.Group as={Row} className='mb-3'>
                                <Form.Label column sm='4'>Summary</Form.Label>
                                <Col sm='8'>
                                    <Editor
                                        apiKey="27k7mo6dhwbg8ogpsyq0gfjtfd4d5682zmurtqp44ean979x"
                                        onInit={(evt, editor) => editorRef.current = editor}
                                        id='summary'
                                        init={{
                                            height: 400,
                                            plugins: [
                                                'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
                                                'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
                                                'insertdatetime', 'media', 'table', 'help', 'wordcount'
                                            ],
                                            toolbar: 'undo redo | blocks | ' +
                                                'bold italic backcolor | alignleft aligncenter ' +
                                                'alignright alignjustify | bullist numlist outdent indent | ' +
                                                'removeformat | help',
                                            content_style: 'body { font-family:Helvetica,Arial,sans-serif; font-size:16px }'
                                        }}
                                    />
                                </Col>
                            </Form.Group>
                            <Button className='w-100 my-2' variant="primary" type="submit">
                                Submit
                            </Button>
                        </Form>
                    </Col>
                </Row>
                <pre>{JSON.stringify(formData, null, 2)}</pre>
            </Container>
        </>
    );
}

export default Projects;

Projects.getLayout = function PageLayout(page: any) {
    return (
        <MainLayout>
            {page}
        </MainLayout>
    )
}