import React, { useState, useRef } from 'react';
import { Button, Col, Container, Form, InputGroup, Row } from 'react-bootstrap';
import { API_URL } from '@/config/constants';
import MainLayout from '@/layouts/MainLayout';
import { postRequestOptions } from '@/utils/Fetch';
import Swal from 'sweetalert2';
import { Editor } from '@tinymce/tinymce-react';

interface FormDataType {
    heading: string,
    description: string,
    writtenBy: string,
    writtenDate: string,
}

function Blogs() {
    const [formData, setFormData] = useState<FormDataType>({
        heading: '',
        description: '',
        writtenBy: '',
        writtenDate: ''
    });

    const descriptionRef = useRef<any>(null);
    const handleOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    }


    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        Swal.fire({
            title: 'Are you sure?',
            text: "You want to create this blog!",
            icon: 'warning',
            showCancelButton: true,
            cancelButtonText: 'No',
            confirmButtonText: 'Yes'
        }).then((result) => {
            if (result.value) {
                try {
                    const fetchData = async () => {
                        formData.description = descriptionRef.current.getContent();
                        const res = await fetch(API_URL + 'api/blogs/create', postRequestOptions(formData));
                        if (res.status === 200) {
                            Swal.fire({
                                icon: 'success',
                                title: 'Success',
                                text: 'Blogs creation successfull!',
                            });
                            setFormData({
                                heading: '',
                                description: '',
                                writtenBy: '',
                                writtenDate: ''
                            });
                            descriptionRef.current.setContent('');
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
                    <h2 className="text-center">Blog Create</h2>
                    <hr />
                    <Form onSubmit={handleSubmit}>
                        <Form.Group as={Row}>
                            <Form.Label column sm='4' className='mb-3'>Heading<span className='text-danger'>*</span></Form.Label>
                            <Col sm='8'>
                                <Form.Control type="text" placeholder="Enter heading of the blog" name="heading" onChange={handleOnChange} value={formData.heading} />
                            </Col>
                        </Form.Group>
                        <Form.Group as={Row} className='mb-3'>
                            <Form.Label column sm='4'>Description</Form.Label>
                            <Col sm='8'>
                                <Editor
                                    apiKey="27k7mo6dhwbg8ogpsyq0gfjtfd4d5682zmurtqp44ean979x"
                                    onInit={(evt, editor) => descriptionRef.current = editor}
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
                        <Form.Group as={Row}>
                            <Form.Label column sm='4' className='mb-3'>Written By<span className='text-danger'>*</span></Form.Label>
                            <Col sm='8'>
                                <Form.Control type="text" placeholder="Enter writter name" name="writtenBy" onChange={handleOnChange} value={formData.writtenBy} />
                            </Col>
                        </Form.Group>
                        <Form.Group as={Row}>
                            <Form.Label column sm='4' className='mb-3'>Written Date<span className='text-danger'>*</span></Form.Label>
                            <Col sm='8'>
                                <Form.Control type="date" placeholder="Enter written date" name="writtenDate" onChange={handleOnChange} value={formData.writtenDate} />
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

export default Blogs;

Blogs.getLayout = function PageLayout(page: any) {
    return (
        <MainLayout>
            {page}
        </MainLayout>
    )
}