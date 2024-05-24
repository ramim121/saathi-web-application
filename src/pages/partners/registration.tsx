import React, { useState, useRef } from 'react';
import { Button, Col, Container, Form, Row } from 'react-bootstrap';
import { API_URL } from '@/config/constants';
import { Editor } from '@tinymce/tinymce-react';
import MainLayout from '@/layouts/MainLayout';

interface FormDataType {
    name: string,
    phoneNumber: string,
    age: number,
    location: string,
    role: string,
    painPoints: string,
    motivation: string,
    interestedIn: string,
    joiningDate: string,
    skills: string
}

function Registration() {
    const [formData, setFormData] = useState<FormDataType>({
        name: '',
        phoneNumber: '',
        age: 0,
        location: '',
        role: '',
        painPoints: '',
        motivation: '',
        interestedIn: '',
        joiningDate: '',
        skills: ''
    });
    const painPointsRef = useRef<any>(null);
    const motivationRef = useRef<any>(null);

    const handleOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    }

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        formData.painPoints = painPointsRef.current.getContent();
        formData.motivation = motivationRef.current.getContent();
        try {
            const res = await fetch(API_URL + 'api/partners/registration', {
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
                    phoneNumber: '',
                    age: 0,
                    location: '',
                    role: '',
                    painPoints: '',
                    motivation: '',
                    interestedIn: '',
                    joiningDate: '',
                    skills: ''
                });
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
                <h2 className="text-center">Partner Registration</h2>
                <hr />
                <Form onSubmit={handleSubmit}>

                    <Row>
                        <Col md={6}>
                            <Form.Group as={Row} className='mb-3'>
                                <Form.Label column sm='4' >Name <span className='text-danger'>*</span></Form.Label>
                                <Col sm='8'>
                                    <Form.Control type="text" placeholder="Enter your full name" name="name" onChange={handleOnChange} required value={formData.name} />
                                </Col>
                            </Form.Group>

                            <Form.Group as={Row} className='mb-3'>
                                <Form.Label column sm='4' >Age <span className='text-danger'>*</span></Form.Label>
                                <Col sm='8'>
                                    <Form.Control type="number" placeholder="Enter your age" name="age" onChange={handleOnChange} required value={formData.age} />
                                </Col>
                            </Form.Group>
                            <Form.Group as={Row} className='mb-3'>
                                <Form.Label column sm='4' >Role <span className='text-danger'>*</span></Form.Label>
                                <Col sm='8'>
                                    <Form.Control type="text" placeholder="Enter your role" name="role" onChange={handleOnChange} required value={formData.role} />
                                </Col>
                            </Form.Group>

                            <Form.Group as={Row} className='mb-3'>
                                <Form.Label column sm='4' >Skills <span className='text-danger'>*</span></Form.Label>
                                <Col sm='8'>
                                    <Form.Control as="textarea" placeholder="Enter your skills" name="skills" onChange={handleOnChange} required rows={2} value={formData.skills} />
                                </Col>
                            </Form.Group>
                            <Form.Group as={Row} className='mb-3'>
                                <Form.Label column sm='4' >Pain Points </Form.Label>
                                <Col sm='8'>
                                    <Editor
                                        apiKey="27k7mo6dhwbg8ogpsyq0gfjtfd4d5682zmurtqp44ean979x"
                                        onInit={(evt, editor) => painPointsRef.current = editor}
                                        id='painPoints'
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
                        </Col>
                        <Col sm={6}>
                            <Form.Group as={Row}>
                                <Form.Label column sm='4' className='mb-3'>Phone Number <span className='text-danger'>*</span></Form.Label>
                                <Col sm='8'>
                                    <Form.Control type="number" placeholder="Enter your phone number" name="phoneNumber" onChange={handleOnChange} required value={formData.phoneNumber} />
                                </Col>
                            </Form.Group>
                            <Form.Group as={Row} className='mb-3'>
                                <Form.Label column sm='4' >Interested In </Form.Label>
                                <Col sm='8'>
                                    <Form.Control type='text' placeholder="Enter your interested projects " name="interestedIn" onChange={handleOnChange} value={formData.interestedIn} />
                                </Col>
                            </Form.Group>

                            <Form.Group as={Row} className='mb-3'>
                                <Form.Label column sm='4' >Joining Date <span className='text-danger'>*</span></Form.Label>
                                <Col sm='8'>
                                    <Form.Control type='date' name="joiningDate" onChange={handleOnChange} required value={formData.joiningDate} />
                                </Col>
                            </Form.Group>
                            <Form.Group as={Row} className='mb-3'>
                                <Form.Label column sm='4' >Location / Address <span className='text-danger'>*</span></Form.Label>
                                <Col sm='8'>
                                    <Form.Control as="textarea" placeholder="Enter your current location/address" name="location" onChange={handleOnChange} required rows={2} value={formData.location} />
                                </Col>
                            </Form.Group>
                            <Form.Group as={Row} className='mb-3'>
                                <Form.Label column sm='4' >Motivation </Form.Label>
                                <Col sm='8'>
                                    <Editor
                                        apiKey="27k7mo6dhwbg8ogpsyq0gfjtfd4d5682zmurtqp44ean979x"
                                        onInit={(evt, editor) => motivationRef.current = editor}
                                        id='motivation'
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
                        </Col>
                    </Row>
                    <Row className='justify-content-center'>
                        <Button className='w-50' variant="primary" type="submit">
                            Submit
                        </Button>
                    </Row>
                </Form>
            </Container>
        </>
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