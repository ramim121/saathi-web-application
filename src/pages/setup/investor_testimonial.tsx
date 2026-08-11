import React, { useState, useEffect, useRef } from "react";
import MainLayout from "@/layouts/MainLayout";
import { Button, Col, Container, Form, Pagination, Row, Table, Spinner } from "react-bootstrap";
import Swal from 'sweetalert2';
import { API_URL, S3_URL } from '@/config/public';
import { getCookie } from '@/utils/GetCookie';
import { getRequestOptions } from '@/utils/Fetch';
import { Editor } from '@tinymce/tinymce-react';

interface FormDataType {
    idInvestorTestimonials?: number;
    name: string;
    nameBn: string;
    image: string | File;
    rating: number | null;
    testimonial: string;
    testimonialBn: string;
    priority: number | null;
}

interface FilterProps {
    idInvestorTestimonials: string;
    name: string;
    rating: string;
    testimonial: string;
    priority: string;
    orderBy: string;
    orderType: string;
    page: number;
    pageSize: number;
}

function InvestorTestimonialSetup() {
    const [formData, setFormData] = useState<FormDataType>({
        idInvestorTestimonials: undefined,
        name: '',
        nameBn: '',
        image: '',
        rating: null,
        testimonial: '',
        testimonialBn: '',
        priority: null
    });

    const [filter, setFilter] = useState<FilterProps>({
        idInvestorTestimonials: '',
        name: '',
        rating: '',
        testimonial: '',
        priority: '',
        orderBy: 'idInvestorTestimonials',
        orderType: 'DESC',
        page: 1,
        pageSize: 10
    });

    const [total, setTotal] = useState<number>(0);
    const [totalPages, setTotalPages] = useState<number>(1);
    const [testimonialList, setTestimonialList] = useState<FormDataType[]>([]);
    const [reload, setReload] = useState<boolean>(true);
    const [loading, setLoading] = useState<boolean>(false);
    const [isEditing, setIsEditing] = useState<boolean>(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const testimonialRef = useRef<any>(null);

    useEffect(() => {
        const fetchInvestorTestimonials = async () => {
            const query = new URLSearchParams(filter as any).toString();
            try {
                const res = await fetch(`/api/investor-testimonials/list?${query}`, getRequestOptions());
                const data = await res.json();
                if (res.status === 200) {
                    setTestimonialList(data.data);
                    setTotal(data.total);
                    setTotalPages(data.totalPages);
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
        };
        fetchInvestorTestimonials();
    }, [filter, reload]);

    const handleInputOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFilter({
            ...filter,
            [name]: value
        });
    };

    const pagesNumber = () => {
        if (total === 0) {
            return [];
        }
        let from = Number(filter.page) - 4;
        if (from < 1) {
            from = 1;
        }
        let to = from + 4 * 2;
        if (to >= Math.ceil(total / 10)) {
            to = Math.ceil(total / 10);
        }
        const pagesArray = [];

        for (let page = from; page <= to; page++) {
            pagesArray.push(page);
        }
        return pagesArray;
    };

    const pageList = () => {
        return pagesNumber().map((pageNumber) => {
            return (
                <Pagination.Item key={pageNumber} active={pageNumber === filter.page} onClick={() => handlePageChange(pageNumber)}>
                    {pageNumber}
                </Pagination.Item>
            );
        });
    };

    const handlePageChange = (page: number) => {
        setFilter({
            ...filter,
            page: page
        });
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const fileType = file.type;
            const validImageTypes = ['image/jpeg', 'image/png', 'image/jpg'];
            if (validImageTypes.includes(fileType)) {
                setFormData({ ...formData, image: file });
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Invalid file type. Please upload a jpeg, jpg, or png image.',
                });
            }
        }
    };

    const renderStarRatingInput = () => {
        const current = formData.rating || 0;
        return (
            <div>
                {[1, 2, 3, 4, 5].map((star) => (
                    <span
                        key={star}
                        style={{ cursor: 'pointer', color: star <= current ? '#ffc107' : '#e4e5e9', fontSize: '1.4rem', marginRight: 4 }}
                        onClick={() => setFormData({ ...formData, rating: star })}
                    >
                        ★
                    </span>
                ))}
            </div>
        );
    };

    const renderStars = (value: number | null | undefined) => {
        const rating = value || 0;
        return (
            <>
                {[1, 2, 3, 4, 5].map((star) => (
                    <span
                        key={star}
                        style={{ color: star <= rating ? '#ffc107' : '#e4e5e9', fontSize: '1.2rem', marginRight: 2 }}
                    >
                        ★
                    </span>
                ))}
            </>
        );
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);

        Swal.fire({
            title: 'Are you sure?',
            text: isEditing ? "You want to update this testimonial!" : "You want to create this testimonial!",
            icon: 'warning',
            showCancelButton: true,
            cancelButtonText: 'No',
            confirmButtonText: 'Yes'
        }).then(async (result) => {
            if (result.value) {
                const newFormData = new FormData();
                if (isEditing && formData.idInvestorTestimonials) {
                    newFormData.append('idInvestorTestimonials', formData.idInvestorTestimonials.toString());
                }
                newFormData.append('name', formData.name);
                newFormData.append('rating', formData.rating?.toString() || '');
                newFormData.append('testimonial', testimonialRef.current ? testimonialRef.current.getContent() : formData.testimonial);
                newFormData.append('priority', formData.priority?.toString() || '');
                newFormData.append('nameBn', formData.nameBn || '');
                newFormData.append('testimonialBn', formData.testimonialBn || '');

                if (formData.image instanceof File) {
                    newFormData.append('image', formData.image);
                }

                try {
                    const url = isEditing ? API_URL + 'api/investor-testimonials/update' : API_URL + 'api/investor-testimonials/create';
                    const res = await fetch(url, {
                        method: 'POST',
                        headers: { 'Authorization': 'Bearer ' + getCookie('saathi-token') },
                        body: newFormData,
                    });

                    const data = await res.json();

                    if (res.status === 200) {
                        Swal.fire({
                            icon: 'success',
                            title: 'Success',
                            text: data.message,
                        });
                        setReload(true);
                        setFormData({
                            idInvestorTestimonials: undefined,
                            name: '',
                            nameBn: '',
                            image: '',
                            rating: null,
                            testimonial: '',
                            testimonialBn: '',
                            priority: null
                        });
                        setIsEditing(false);
                        if (fileInputRef.current) {
                            fileInputRef.current.value = '';
                        }
                        if (testimonialRef.current) {
                            testimonialRef.current.setContent('');
                        }
                    } else {
                        Swal.fire({
                            icon: 'error',
                            title: 'Error',
                            html: data.message,
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
    };

    const handleEdit = (item: FormDataType) => {
        setFormData({
            idInvestorTestimonials: item.idInvestorTestimonials,
            name: item.name,
            nameBn: item.nameBn || '',
            image: item.image,
            rating: item.rating,
            testimonial: item.testimonial,
            testimonialBn: item.testimonialBn || '',
            priority: item.priority
        });
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
        if (testimonialRef.current) {
            testimonialRef.current.setContent(item.testimonial || '');
        }
        setIsEditing(true);
    };

    const handleDelete = async (id?: number) => {
        if (!id) return;

        Swal.fire({
            title: 'Are you sure?',
            text: "You want to delete this testimonial!",
            icon: 'warning',
            showCancelButton: true,
            cancelButtonText: 'No',
            confirmButtonText: 'Yes'
        }).then(async (result) => {
            if (result.value) {
                try {
                    const res = await fetch(API_URL + `api/investor-testimonials/delete?idInvestorTestimonials=${id}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': 'Bearer ' + getCookie('saathi-token') },
                    });
                    const data = await res.json();
                    if (res.status === 200) {
                        Swal.fire({
                            icon: 'success',
                            title: 'Success',
                            text: data.message,
                        });
                        setReload(true);
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
                        text: err.message || 'Something went wrong!',
                    });
                }
            }
        });
    };

    return (
        <>
            <Container>
                <Row className="justify-content-center">
                    <Col md={8}>
                        <h4 className="text-start">Investor Testimonial</h4>
                        <hr />
                        <Form onSubmit={handleSubmit}>
                            <Form.Group as={Row}>
                                <Form.Label column sm='3' className='mb-3'>Name<span className='text-danger'>*</span></Form.Label>
                                <Col sm='9'>
                                    <Form.Control
                                        type="text"
                                        placeholder="Enter name"
                                        name="name"
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        value={formData.name}
                                    />
                                </Col>
                            </Form.Group>
                            <Form.Group as={Row}>
                                {/* Bangla counterpart — optional; blank falls back to English. */}
                                <Form.Label column sm='3' className='mb-3'>Name (বাংলা)</Form.Label>
                                <Col sm='9'>
                                    <Form.Control
                                        type="text"
                                        placeholder="নাম লিখুন"
                                        name="nameBn"
                                        lang="bn"
                                        onChange={(e) => setFormData({ ...formData, nameBn: e.target.value })}
                                        value={formData.nameBn}
                                    />
                                    <Form.Text muted>Optional. Falls back to the English name if left blank.</Form.Text>
                                </Col>
                            </Form.Group>
                            <Form.Group as={Row}>
                                <Form.Label column sm='3' className='mb-3'>Image<span className='text-danger'>*</span></Form.Label>
                                <Col sm='9'>
                                    <Form.Control type="file" name="image" onChange={handleFileUpload} ref={fileInputRef} />
                                    {typeof formData.image === 'string' && formData.image && (
                                        <div className="mt-2">
                                            <img
                                                src={`${S3_URL}investor-testimonials/${formData.image}`}
                                                alt={formData.image}
                                                width={100}
                                                height={100}
                                            />
                                        </div>
                                    )}
                                </Col>
                            </Form.Group>
                            <Form.Group as={Row}>
                                <Form.Label column sm='3' className='mb-3'>Rating<span className='text-danger'>*</span></Form.Label>
                                <Col sm='9'>
                                    {renderStarRatingInput()}
                                </Col>
                            </Form.Group>
                            <Form.Group as={Row}>
                                <Form.Label column sm='3' className='mb-3'>Testimonial<span className='text-danger'>*</span></Form.Label>
                                <Col sm='9'>
                                    <Form.Control
                                        as="textarea"
                                        rows={5}
                                        placeholder="Enter testimonial"
                                        name="testimonial"
                                        value={formData.testimonial}
                                        onChange={(e) => setFormData({ ...formData, testimonial: e.target.value })}
                                    />
                                </Col>
                            </Form.Group>
                            <Form.Group as={Row}>
                                {/* Bangla counterpart — optional; blank falls back to English. */}
                                <Form.Label column sm='3' className='mb-3'>Testimonial (বাংলা)</Form.Label>
                                <Col sm='9'>
                                    <Form.Control
                                        as="textarea"
                                        rows={5}
                                        placeholder="বাংলায় প্রশংসাপত্র লিখুন"
                                        name="testimonialBn"
                                        lang="bn"
                                        value={formData.testimonialBn}
                                        onChange={(e) => setFormData({ ...formData, testimonialBn: e.target.value })}
                                    />
                                    <Form.Text muted>Optional. Falls back to the English testimonial if left blank.</Form.Text>
                                </Col>
                            </Form.Group>
                            <Form.Group as={Row} className="mt-3">
                                <Form.Label column sm='3' className='mb-3'>Priority<span className='text-danger'>*</span></Form.Label>
                                <Col sm='9'>
                                    <Form.Control
                                        type="number"
                                        placeholder="Enter priority"
                                        name="priority"
                                        onChange={(e) => setFormData({ ...formData, priority: e.target.value ? parseInt(e.target.value) : null })}
                                        value={formData.priority || ''}
                                    />
                                </Col>
                            </Form.Group>
                            <Row>
                                <Col sm='3'></Col>
                                <Col sm='9'>
                                    <Row className='justify-content-start'>
                                        <Button className='w-50' variant="primary" type="submit" disabled={loading}>
                                            {loading && <Spinner as="span" animation="grow" size="sm" role="status" aria-hidden="true" />}
                                            {loading ? 'Submitting...' : (isEditing ? 'Update' : 'Submit')}
                                        </Button>
                                    </Row>
                                </Col>
                            </Row>
                        </Form>
                    </Col>
                </Row>
            </Container>
            <Container className='mt-5'>
                <h4 className="text-start">Investor Testimonial List</h4>
                <hr />
                <Table responsive striped bordered hover>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Name</th>
                            <th>Image</th>
                            <th>Rating</th>
                            <th>Testimonial</th>
                            <th>Priority</th>
                            <th>Actions</th>
                        </tr>
                        <tr>
                            <td>
                                <input
                                    type="number"
                                    className="form-control form-control-sm"
                                    placeholder="Search"
                                    name="idInvestorTestimonials"
                                    onChange={handleInputOnChange}
                                    value={filter.idInvestorTestimonials}
                                />
                            </td>
                            <td>
                                <input
                                    type="text"
                                    className="form-control form-control-sm"
                                    placeholder="Search"
                                    name="name"
                                    onChange={handleInputOnChange}
                                    value={filter.name}
                                />
                            </td>
                            <td></td>
                            <td>
                                <input
                                    type="number"
                                    className="form-control form-control-sm"
                                    placeholder="Search"
                                    name="rating"
                                    onChange={handleInputOnChange}
                                    value={filter.rating}
                                />
                            </td>
                            <td>
                                <input
                                    type="text"
                                    className="form-control form-control-sm"
                                    placeholder="Search"
                                    name="testimonial"
                                    onChange={handleInputOnChange}
                                    value={filter.testimonial}
                                />
                            </td>
                            <td>
                                <input
                                    type="number"
                                    className="form-control form-control-sm"
                                    placeholder="Search"
                                    name="priority"
                                    onChange={handleInputOnChange}
                                    value={filter.priority}
                                />
                            </td>
                            <td></td>
                        </tr>
                    </thead>
                    <tbody>
                        {testimonialList.length > 0 ? testimonialList.map((item, index) => (
                            <tr key={index}>
                                <td>{item.idInvestorTestimonials}</td>
                                <td>{item.name}</td>
                                <td>
                                    {typeof item.image === 'string' && item.image && (
                                        <img
                                            src={`${S3_URL}investor-testimonials/${item.image}`}
                                            alt={item.image}
                                            width={80}
                                            height={80}
                                        />
                                    )}
                                </td>
                                <td>{renderStars(item.rating)}</td>
                                <td>{item.testimonial}</td>
                                <td>{item.priority}</td>
                                <td>
                                    <Button size="sm" variant="info" className="me-2" onClick={() => handleEdit(item)}>
                                        Edit
                                    </Button>
                                    <Button variant="danger" size="sm" onClick={() => handleDelete(item.idInvestorTestimonials)}>
                                        Delete
                                    </Button>
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={7} className="text-center">No Investor Testimonial found</td>
                            </tr>
                        )}
                    </tbody>
                </Table>
                <Pagination>
                    <Pagination.First onClick={() => handlePageChange(1)} disabled={filter.page === 1} />
                    <Pagination.Prev onClick={() => handlePageChange(filter.page - 1)} disabled={filter.page === 1} />
                    {pageList()}
                    <Pagination.Next onClick={() => handlePageChange(filter.page + 1)} disabled={filter.page === totalPages} />
                    <Pagination.Last onClick={() => handlePageChange(totalPages)} disabled={filter.page === totalPages} />
                </Pagination>
            </Container>
        </>
    );
}

export default InvestorTestimonialSetup;

InvestorTestimonialSetup.getLayout = function PageLayout(page: any) {
    return (
        <MainLayout>
            {page}
        </MainLayout>
    );
};

