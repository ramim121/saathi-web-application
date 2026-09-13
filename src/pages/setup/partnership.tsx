import React, { useState, useEffect, useRef } from "react";
import MainLayout from "@/layouts/MainLayout";
import { Button, Col, Container, Form, Pagination, Row, Table, Spinner } from "react-bootstrap";
import Swal from 'sweetalert2';
import { API_URL, S3_URL } from '@/config/public';
import { getCookie } from '@/utils/GetCookie';
import { getRequestOptions } from '@/utils/Fetch';

interface PartnershipFormData {
    idPartnerships?: number;
    name: string;
    nameBn: string;
    image: string | File;
    priority: number | null;
}

interface FilterProps {
    idPartnerships: string;
    name: string;
    orderBy: string;
    orderType: string;
    page: number;
    pageSize: number;
}

function PartnershipPage() {
    const [formData, setFormData] = useState<PartnershipFormData>({
        idPartnerships: undefined,
        name: '',
        nameBn: '',
        image: '',
        priority: null
    });

    const [filter, setFilter] = useState<FilterProps>({
        idPartnerships: '',
        name: '',
        orderBy: 'idPartnerships',
        orderType: 'DESC',
        page: 1,
        pageSize: 10
    });

    const [total, setTotal] = useState<number>(0);
    const [totalPages, setTotalPages] = useState<number>(1);
    const [partnershipList, setPartnershipList] = useState<PartnershipFormData[]>([]);
    const [reload, setReload] = useState<boolean>(true);
    const [loading, setLoading] = useState<boolean>(false);
    const [isEditing, setIsEditing] = useState<boolean>(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const fetchPartnershipList = async () => {
            const query = new URLSearchParams(filter as any).toString();
            try {
                const res = await fetch(`/api/partnerships/list?${query}`, getRequestOptions());
                const data = await res.json();
                if (res.status === 200) {
                    setPartnershipList(data.data);
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
        }
        fetchPartnershipList();
    }, [filter, reload]);

    const handleInputOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFilter({
            ...filter,
            [name]: value
        });
    }

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
            to = Math.ceil(total / 10)
        }
        const pagesArray = [];

        for (let page = from; page <= to; page++) {
            pagesArray.push(page)
        }
        return pagesArray
    }

    const pageList = () => {
        return pagesNumber().map((pageNumber) => {
            return (
                <Pagination.Item key={pageNumber} active={pageNumber === filter.page} onClick={() => handlePageChange(pageNumber)}>
                    {pageNumber}
                </Pagination.Item>
            )
        })
    }

    const handlePageChange = (page: number) => {
        setFilter({
            ...filter,
            page: page
        })
    }

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
    }

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);

        Swal.fire({
            title: 'Are you sure?',
            text: isEditing ? "You want to update this partnership!" : "You want to create this partnership!",
            icon: 'warning',
            showCancelButton: true,
            cancelButtonText: 'No',
            confirmButtonText: 'Yes'
        }).then(async (result) => {
            if (result.value) {
                const newFormData = new FormData();
                if (isEditing && formData.idPartnerships) {
                    newFormData.append('idPartnerships', formData.idPartnerships.toString());
                }
                newFormData.append('name', formData.name);
                newFormData.append('nameBn', formData.nameBn || '');
                if (formData.image instanceof File) {
                    newFormData.append('image', formData.image);
                }
                newFormData.append('priority', formData.priority?.toString() || '');
                try {
                    const url = isEditing ? API_URL + 'api/partnerships/update' : API_URL + 'api/partnerships/create';
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
                            idPartnerships: undefined,
                            name: '',
                            nameBn: '',
                            image: '',
                            priority: null
                        });
                        setIsEditing(false);
                        if (fileInputRef.current) {
                            fileInputRef.current.value = '';
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

    const handleEdit = (item: PartnershipFormData) => {
        setFormData({
            idPartnerships: item.idPartnerships,
            name: item.name,
            nameBn: item.nameBn || '',
            image: item.image,
            priority: item.priority
        });
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
        setIsEditing(true);
    };

    const handleDelete = async (id?: number) => {
        if (!id) return;

        Swal.fire({
            title: 'Are you sure?',
            text: "You want to delete this partnership!",
            icon: 'warning',
            showCancelButton: true,
            cancelButtonText: 'No',
            confirmButtonText: 'Yes'
        }).then(async (result) => {
            if (result.value) {
                try {
                    const res = await fetch(API_URL + `api/partnerships/delete?idPartnerships=${id}`, {
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
                    <Col md={6}>
                        <h4 className="text-start">Partnerships</h4>
                        <hr />
                        <Form onSubmit={handleSubmit}>
                            <Form.Group as={Row}>
                                <Form.Label column sm='4' className='mb-3'>Name<span className='text-danger'>*</span></Form.Label>
                                <Col sm='8'>
                                    <Form.Control
                                        type="text"
                                        placeholder="Enter partnership name"
                                        name="name"
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        value={formData.name}
                                    />
                                </Col>
                            </Form.Group>
                            <Form.Group as={Row}>
                                {/* Bangla counterpart. Optional — content is written in
                                    English first and translated afterwards, so leaving
                                    this blank simply falls back to the English name. */}
                                <Form.Label column sm='4' className='mb-3'>Name (বাংলা)</Form.Label>
                                <Col sm='8'>
                                    <Form.Control
                                        type="text"
                                        placeholder="অংশীদারের নাম লিখুন"
                                        name="nameBn"
                                        lang="bn"
                                        onChange={(e) => setFormData({ ...formData, nameBn: e.target.value })}
                                        value={formData.nameBn}
                                    />
                                    <Form.Text muted>Optional. Falls back to the English name if left blank.</Form.Text>
                                </Col>
                            </Form.Group>
                            <Form.Group as={Row}>
                                <Form.Label column sm='4' className='mb-3'>Image<span className='text-danger'>*</span></Form.Label>
                                <Col sm='8'>
                                    <Form.Control type="file" name="image" onChange={handleFileUpload} ref={fileInputRef} />
                                    {typeof formData.image === 'string' && formData.image && (
                                        <div className="mt-2">
                                            <img
                                                src={`${S3_URL}partnerships/${formData.image}`}
                                                alt={formData.image}
                                                width={100}
                                                height={100}
                                            />
                                        </div>
                                    )}
                                </Col>
                            </Form.Group>
                            <Form.Group as={Row}>
                                <Form.Label column sm='4' className='mb-3'>Priority<span className='text-danger'>*</span></Form.Label>
                                <Col sm='8'>
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
                                <Col sm='4'></Col>
                                <Col sm='8'>
                                    <Row className='justify-content-center'>
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
                <h4 className="text-start">Partnership List</h4>
                <hr />
                <Table responsive striped bordered hover>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Name</th>
                            <th>Image</th>
                            <th>Priority</th>
                            <th>Actions</th>
                        </tr>
                        <tr>
                            <td>
                                <input type="number" className="form-control form-control-sm" placeholder="Search" name="idPartnerships" onChange={handleInputOnChange} value={filter.idPartnerships} />
                            </td>
                            <td>
                                <input type="text" className="form-control form-control-sm" placeholder="Search" name="name" onChange={handleInputOnChange} value={filter.name} />
                            </td>
                            <td></td>
                            <td></td>
                            <td></td>
                        </tr>
                    </thead>
                    <tbody>
                        {partnershipList.length > 0 ? partnershipList.map((item, index) => (
                            <tr key={index}>
                                <td>{item.idPartnerships}</td>
                                <td>{item.name}</td>
                                <td>
                                    {typeof item.image === 'string' && item.image && (
                                        <img src={`${S3_URL}partnerships/${item.image}`} alt={item.name} width={100} height={100} />
                                    )}
                                </td>
                                <td>{item.priority}</td>
                                <td>
                                    <Button size="sm" variant="info" className="me-2" onClick={() => handleEdit(item)}>
                                        Edit
                                    </Button>
                                    <Button variant="danger" size="sm" onClick={() => handleDelete(item.idPartnerships)}>
                                        Delete
                                    </Button>
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={5} className="text-center">No Partnership found</td>
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
    )
}

export default PartnershipPage;

PartnershipPage.getLayout = function PageLayout(page: any) {
    return (
        <MainLayout>
            {page}
        </MainLayout>
    )
}

