import React, { useState, useRef } from 'react';
import { Button, Col, Container, Form, Spinner, Row } from 'react-bootstrap';
import { API_URL } from '@/config/public';
import MainLayout from '@/layouts/MainLayout';
import Swal from 'sweetalert2';
import { Editor } from '@tinymce/tinymce-react';
import { getCookie } from '@/utils/GetCookie';

interface FormDataType {
    heading: string,
    headingBn: string,
    description: string,
    writtenBy: string,
    writtenDate: string,
    featuredImage: File | null;
}

function Blogs() {
    const [formData, setFormData] = useState<FormDataType>({
        heading: '',
        headingBn: '',
        description: '',
        writtenBy: '',
        writtenDate: '',
        featuredImage: null
    });

    const descriptionRef = useRef<any>(null);
    // The Bangla body needs its own editor instance — a plain textarea would
    // strip the formatting that the English body is allowed to carry.
    const descriptionBnRef = useRef<any>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [loading, setLoading] = useState<boolean>(false);

    const handleOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    }

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const fileType = file.type;
            const validImageTypes = ['image/jpeg', 'image/png', 'image/jpg'];
            if (validImageTypes.includes(fileType)) {
                setFormData({ ...formData, featuredImage: file });
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
        setLoading(true);

        Swal.fire({
            title: 'Are you sure?',
            text: "You want to create this blog!",
            icon: 'warning',
            showCancelButton: true,
            cancelButtonText: 'No',
            confirmButtonText: 'Yes'
        }).then(async (result) => {
            if (result.value) {
                try {
                    const newFormData = new FormData();
                    newFormData.append('heading', formData.heading);
                    newFormData.append('description', descriptionRef.current.getContent());
                    newFormData.append('headingBn', formData.headingBn || '');
                    newFormData.append('descriptionBn', descriptionBnRef.current ? descriptionBnRef.current.getContent() : '');
                    newFormData.append('writtenBy', formData.writtenBy);
                    newFormData.append('writtenDate', formData.writtenDate);
                    if (formData.featuredImage !== null)
                        newFormData.append('featuredImage', formData.featuredImage);

                    const res = await fetch(API_URL + 'api/blogs/create', {
                        method: 'POST',
                        headers: { 'Authorization': 'Bearer ' + getCookie('saathi-token') },
                        body: newFormData,
                    });

                    if (res.status === 200) {
                        Swal.fire({
                            icon: 'success',
                            title: 'Success',
                            text: 'Blog created successfully!',
                        });
                        setFormData({
                            heading: '',
                            headingBn: '',
                            description: '',
                            writtenBy: '',
                            writtenDate: '',
                            featuredImage: null
                        });
                        if (fileInputRef.current) {
                            fileInputRef.current.value = '';  // Clear file input
                        }
                        descriptionRef.current.setContent('');
                        descriptionBnRef.current?.setContent('');
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
                }
                finally {
                    setLoading(false);
                }
            } else {
                setLoading(false);
            }
        });
    }

    return (
        <Container>
            <Row className="justify-content-center">
                <Col md={10}>
                    <h4 className="text-start">Blog Create</h4>
                    <hr />
                    <Form onSubmit={handleSubmit}>
                        <Form.Group as={Row}>
                            <Form.Label column sm='2' className='mb-3'>Heading<span className='text-danger'>*</span></Form.Label>
                            <Col sm='10'>
                                <Form.Control type="text" placeholder="Enter heading of the blog" name="heading" onChange={handleOnChange} value={formData.heading} />
                            </Col>
                        </Form.Group>
                        <Form.Group as={Row}>
                            {/* Bangla counterpart — optional; blank falls back to English. */}
                            <Form.Label column sm='2' className='mb-3'>Heading (বাংলা)</Form.Label>
                            <Col sm='10'>
                                <Form.Control type="text" placeholder="ব্লগের শিরোনাম লিখুন" name="headingBn" lang="bn" onChange={handleOnChange} value={formData.headingBn} />
                                <Form.Text muted>Optional. Falls back to the English heading if left blank.</Form.Text>
                            </Col>
                        </Form.Group>
                        <Form.Group as={Row} className='mb-3'>
                            <Form.Label column sm='2'>Description</Form.Label>
                            <Col sm='10'>
                                <Editor
                                    apiKey="abqylwi3epqtdz7e4t0aasmr5f62etpkkrrd9kiuktqf004r"
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
                        <Form.Group as={Row} className='mb-3'>
                            {/* Bangla body. Optional — blank falls back to the English one.
                                Its own editor instance, with a Bangla-capable font stack in
                                content_style so the editing surface renders the script
                                instead of tofu boxes. */}
                            <Form.Label column sm='2'>Description (বাংলা)</Form.Label>
                            <Col sm='10'>
                                <Editor
                                    apiKey="abqylwi3epqtdz7e4t0aasmr5f62etpkkrrd9kiuktqf004r"
                                    onInit={(evt, editor) => descriptionBnRef.current = editor}
                                    id='descriptionBn'
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
                                        content_style: 'body { font-family:"Noto Sans Bengali","Nirmala UI",Helvetica,Arial,sans-serif; font-size:16px; line-height:1.7 }'
                                    }}
                                />
                                <Form.Text muted>Optional. Falls back to the English description if left blank.</Form.Text>
                            </Col>
                        </Form.Group>
                        <Form.Group as={Row}>
                            <Form.Label column sm='2' className='mb-3'>Featured Image</Form.Label>
                            <Col sm='10'>
                                <Form.Control type="file" name="categoryImage" onChange={handleFileUpload} ref={fileInputRef} />
                            </Col>
                        </Form.Group>
                        <Form.Group as={Row}>
                            <Form.Label column sm='2' className='mb-3'>Written By<span className='text-danger'>*</span></Form.Label>
                            <Col sm='10'>
                                <Form.Control type="text" placeholder="Enter writter name" name="writtenBy" onChange={handleOnChange} value={formData.writtenBy} />
                            </Col>
                        </Form.Group>
                        <Form.Group as={Row}>
                            <Form.Label column sm='2' className='mb-3'>Written Date<span className='text-danger'>*</span></Form.Label>
                            <Col sm='10'>
                                <Form.Control type="date" placeholder="Enter written date" name="writtenDate" onChange={handleOnChange} value={formData.writtenDate} />
                            </Col>
                        </Form.Group>
                        <Row className='justify-content-center'>
                            <Button className='w-25' variant="primary" type="submit" disabled={loading}>
                                {loading && <Spinner as="span" animation="grow" size="sm" role="status" aria-hidden="true" />}
                                {loading ? 'Submitting...' : 'Submit'}
                            </Button>
                        </Row>
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