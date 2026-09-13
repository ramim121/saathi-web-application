import React, { useState, useEffect } from "react";
import MainLayout from "@/layouts/MainLayout";
import { Button, Col, Container, Form, Pagination, Row, Table, Spinner } from "react-bootstrap";
import Swal from 'sweetalert2';
import { API_URL } from '@/config/public';
import { getRequestOptions, postRequestOptions } from '@/utils/Fetch';

interface FormDataType {
    idUnit?: number
    unitName: string
    unitCode: string
}

interface FilterProps {
    idUnit: string
    unitName: string
    unitCode: string
    orderBy: string
    orderType: string
    page: number
    pageSize: number
}

function Unit() {

    const [idUnit, setIdUnit] = useState<number>(0);
    const [formData, setFormData] = useState<FormDataType>({
        unitName: '',
        unitCode: ''
    });

    const [filter, setFilter] = useState<FilterProps>({
        idUnit: '',
        unitName: '',
        unitCode: '',
        orderBy: 'idUnit',
        orderType: 'ASC',
        page: 1,
        pageSize: 10
    });


    const [total, setTotal] = useState<number>(0);
    const [totalPages, setTotalPages] = useState<number>(1);
    const [unitList, setUnitList] = useState<FormDataType[]>([]);
    const [reload, setReload] = useState<boolean>(true);
    const [loading, setLoading] = useState<boolean>(false);

    useEffect(() => {
        const fetchUnitList = async () => {
            const query = new URLSearchParams(filter as any).toString();
            try {
                const res = await fetch(`/api/unit/list?${query}`, getRequestOptions());
                const data = await res.json();
                if (res.status === 200) {
                    setUnitList(data.data);
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
        fetchUnitList();
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

    const handleEditChange = (unit: FormDataType) => () => {
        setIdUnit(unit.idUnit ?? 0);
        setFormData({
            unitName: unit.unitName,
            unitCode: unit.unitCode
        });
    }

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        Swal.fire({
            title: 'Are you sure?',
            text: `You want to ${idUnit !== 0 ? 'update' : 'create'} this unit!`,
            icon: 'warning',
            showCancelButton: true,
            cancelButtonText: 'No',
            confirmButtonText: 'Yes'
        }).then(async (result) => {
            if (result.value) {
                try {
                    const api = idUnit !== 0 ? `api/unit/update/${idUnit}` : 'api/unit/create';
                    const res = await fetch(API_URL + api, postRequestOptions(formData));
                    if (res.status === 200) {
                        Swal.fire({
                            icon: 'success',
                            title: 'Success',
                            text: (await res.json()).message,
                        });
                        setReload(true);
                        setIdUnit(0);
                        setFormData({
                            unitName: '',
                            unitCode: ''
                        });

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
    };

    return (
        <>
            <Container>
                <Row className="justify-content-center">
                    <Col md={6}>
                        <h4 className="text-start">Units</h4>
                        <hr />
                        <Form onSubmit={handleSubmit}>
                            <Form.Group as={Row}>
                                <Form.Label column sm='4' className='mb-3'>Name<span className='text-danger'>*</span></Form.Label>
                                <Col sm='8'>
                                    <Form.Control type="text" name="unitName" value={formData.unitName} onChange={(e) => setFormData({ ...formData, unitName: e.target.value })} required />
                                </Col>
                            </Form.Group>
                            <Form.Group as={Row}>
                                <Form.Label column sm='4' className='mb-3'>Code<span className='text-danger'>*</span></Form.Label>
                                <Col sm='8'>
                                    <Form.Control type="text" name="unitCode" value={formData.unitCode} onChange={(e) => setFormData({ ...formData, unitCode: e.target.value })} required />
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


            <Container className='mt-5'>
                <h4 className="text-start">Unit List</h4>
                <hr />
                <Table responsive striped bordered hover>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Name</th>
                            <th>Code</th>
                            <th>Actions</th>
                        </tr>
                        <tr>
                            <td>
                                <input type="number" className="form-control form-control-sm" placeholder="Search" name="idUnit" onChange={handleInputOnChange} value={filter.idUnit} />
                            </td>
                            <td>
                                <input type="text" className="form-control form-control-sm" placeholder="Search" name="unitName" onChange={handleInputOnChange} value={filter.unitName} />
                            </td>
                            <td>
                                <input type="text" className="form-control form-control-sm" placeholder="Search" name="unitCode" onChange={handleInputOnChange} value={filter.unitCode} />
                            </td>
                            <td></td>

                        </tr>
                    </thead>
                    <tbody>
                        {unitList.length > 0 ? unitList.map((unit, index) => (
                            <tr key={index}>
                                <td>{unit.idUnit}</td>
                                <td>{unit.unitName}</td>
                                <td>{unit.unitCode}</td>
                                <td>
                                    <Button variant="primary" size="sm" onClick={handleEditChange(unit)}>Edit</Button>
                                </td>
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={4} className="text-center">No Unit found</td>
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

export default Unit;

Unit.getLayout = function PageLayout(page: any) {
    return (
        <MainLayout>
            {page}
        </MainLayout>
    )
}