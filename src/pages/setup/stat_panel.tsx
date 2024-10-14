import React, { useState, useEffect } from "react";
import MainLayout from "@/layouts/MainLayout";
import { Button, Col, Container, Form, Pagination, Row, Table } from "react-bootstrap";
import Swal from 'sweetalert2';
import { API_URL } from '@/config/constants';
import { getCookie } from '@/utils/GetCookie';
import { getRequestOptions } from '@/utils/Fetch';
import Image from "next/image";
import { S3_URL } from '@/config/constants';

interface FormDataType {
    idAppStatPanel?: number
    statType: string
    statLabel: string
    statValue: string | number | File
}

interface FilterProps {
    idAppStatPanel: string
    statLabel: string
    statValue: string
    statType: string
    orderBy: string
    orderType: string
    page: number
    pageSize: number
}

function StatPanel() {

    const [formData, setFormData] = useState<FormDataType>({
        statType: 'text',
        statLabel: '',
        statValue: ''
    });

    const [filter, setFilter] = useState<FilterProps>({

        idAppStatPanel: '',
        statLabel: '',
        statValue: '',
        statType: '',
        orderBy: 'idAppStatPanel',
        orderType: 'DESC',
        page: 1,
        pageSize: 10
    });

    const [total, setTotal] = useState<number>(0);
    const [totalPages, setTotalPages] = useState<number>(1);
    const [statPanelList, setStatPanelList] = useState<FormDataType[]>([]);
    const [reload, setReload] = useState<boolean>(true);

    useEffect(() => {
        const fetchAppStatPanelList = async () => {
            const query = new URLSearchParams(filter as any).toString();
            try {
                const res = await fetch(`/api/stat-panels/list?${query}`, getRequestOptions());
                const data = await res.json();
                if (res.status === 200) {
                    setStatPanelList(data.data);
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
        fetchAppStatPanelList();
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
        let to = from + 4 * 2
        if (to >= Math.ceil(total / 10)) {
            to = Math.ceil(total / 10)
        }
        let pagesArray = []

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

    const handleStatTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setFormData({ ...formData, statType: e.target.value, statValue: '' });
    }

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const fileType = file.type;
            const validImageTypes = ['image/jpeg', 'image/png', 'image/jpg'];
            if (validImageTypes.includes(fileType)) {
                setFormData({ ...formData, statValue: file });
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Invalid file type. Please upload a jpeg, jpg, or png image.',
                });
            }
        }
    }

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        Swal.fire({
            title: 'Are you sure?',
            text: "You want to create this stat!",
            icon: 'warning',
            showCancelButton: true,
            cancelButtonText: 'No',
            confirmButtonText: 'Yes'
        }).then((result) => {
            if (result.value) {
                const newFormData = new FormData();
                newFormData.append('statType', formData.statType);
                newFormData.append('statLabel', formData.statLabel);
                if (formData.statType === 'number') {
                    newFormData.append('statValue', formData.statValue as string);
                }
                else if (formData.statType === 'image') {
                    newFormData.append('statValue', formData.statValue as File);
                }
                else {
                    newFormData.append('statValue', formData.statValue as string);
                }

                try {
                    const fetchData = async () => {
                        const res = await fetch(API_URL + 'api/stat-panels/create', {
                            method: 'POST',
                            headers: { 'Authorization': 'Bearer ' + getCookie('saathi-token') },
                            body: newFormData,
                        });
                        if (res.status === 200) {
                            Swal.fire({
                                icon: 'success',
                                title: 'Success',
                                text: (await res.json()).message,
                            });
                            setReload(true);
                            setFormData({
                                statType: 'text',
                                statLabel: '',
                                statValue: ''
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
        <>
            <Container>
                <Row className="justify-content-center">
                    <Col md={6}>
                        <h4 className="text-start">Stat Panel</h4>
                        <hr />
                        <Form onSubmit={handleSubmit}>
                            <Form.Group as={Row}>
                                <Form.Label column sm='4' className='mb-3'>Type<span className='text-danger'>*</span></Form.Label>
                                <Col sm='8'>
                                    <Form.Select name='investmentType' onChange={handleStatTypeChange} value={formData.statType}>
                                        <option>Select stat type</option>
                                        <option value="text">Text</option>
                                        <option value="number">Number</option>
                                        <option value="image">Image</option>
                                    </Form.Select>
                                </Col>
                            </Form.Group>
                            <Form.Group as={Row}>
                                <Form.Label column sm='4' className='mb-3'>Label<span className='text-danger'>*</span></Form.Label>
                                <Col sm='8'>
                                    <Form.Control type="text" placeholder="Enter stat label" name="statLabel" onChange={(e) => setFormData({ ...formData, statLabel: e.target.value })} value={formData.statLabel} />
                                </Col>
                            </Form.Group>
                            {formData.statType === 'number' && (
                                <Form.Group as={Row}>
                                    <Form.Label column sm='4' className='mb-3'>Value<span className='text-danger'>*</span></Form.Label>
                                    <Col sm='8'>
                                        <Form.Control type="number" placeholder="Enter stat value" name="statValue" onChange={(e) => setFormData({ ...formData, statValue: e.target.value })} value={formData.statValue as string} />
                                    </Col>
                                </Form.Group>
                            )}
                            {formData.statType === 'image' && (
                                <Form.Group as={Row}>
                                    <Form.Label column sm='4' className='mb-3'>Value<span className='text-danger'>*</span></Form.Label>
                                    <Col sm='8'>
                                        <Form.Control type="file" name="statValue" onChange={handleFileUpload} />
                                    </Col>
                                </Form.Group>
                            )}
                            {formData.statType === 'text' && (
                                <Form.Group as={Row}>
                                    <Form.Label column sm='4' className='mb-3'>Value<span className='text-danger'>*</span></Form.Label>
                                    <Col sm='8'>
                                        <Form.Control type="text" placeholder="Enter stat value" name="statValue" onChange={(e) => setFormData({ ...formData, statValue: e.target.value })} value={formData.statValue as string} />
                                    </Col>
                                </Form.Group>
                            )}
                            <Row>
                                <Col sm='4'></Col>
                                <Col sm='8'>
                                    <Row className='justify-content-center'>
                                        <Button className='w-50' variant="primary" type="submit">
                                            Submit
                                        </Button>
                                    </Row>
                                </Col>
                            </Row>
                        </Form>
                        {/* <pre>{JSON.stringify(formData, null, 2)}</pre> */}
                    </Col>
                </Row>
            </Container>
            <Container className='mt-5'>
                <h4 className="text-start">Stat Panel List</h4>
                <hr />
                <Table responsive striped bordered hover>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Stat Label</th>
                            <th>Stat Value</th>
                            <th>Stat Type</th>
                            {/* <th>Actions</th> */}
                        </tr>
                        <tr>
                            <td>
                                <input type="number" className="form-control form-control-sm" placeholder="Search" name="idAppStatPanel" onChange={handleInputOnChange} value={filter.idAppStatPanel} />
                            </td>
                            <td>
                                <input type="text" className="form-control form-control-sm" placeholder="Search" name="statLabel" onChange={handleInputOnChange} value={filter.statLabel} />
                            </td>
                            <td>
                                <input type="text" className="form-control form-control-sm" placeholder="Search" name="statValue" onChange={handleInputOnChange} value={filter.statValue} />
                            </td>
                            <td>
                                <input type="text" className="form-control form-control-sm" placeholder="Search" name="statType" onChange={handleInputOnChange} value={filter.statType} />
                            </td>

                        </tr>
                    </thead>
                    <tbody>
                        {statPanelList.length > 0 ? statPanelList.map((panel, index) => (
                            <tr key={index}>
                                <td>{panel.idAppStatPanel}</td>
                                <td>{panel.statLabel}</td>
                                <td>
                                    {(panel.statType === 'image' && typeof panel.statValue === 'string') ? (
                                        <Image src={`${S3_URL}stat-panel/${panel.statValue}`} alt={panel.statValue} width={100} height={100} />
                                    ) : (
                                        typeof panel.statValue === 'string' || typeof panel.statValue === 'number' ? panel.statValue : null
                                    )}
                                </td>
                                <td>{panel.statType.charAt(0).toUpperCase() + panel.statType.slice(1)}</td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={4} className="text-center">No Stat Panel found</td>
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

export default StatPanel;

StatPanel.getLayout = function PageLayout(page: any) {
    return (
        <MainLayout>
            {page}
        </MainLayout>
    )
}