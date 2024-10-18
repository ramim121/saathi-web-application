import React, { useState, useEffect } from "react";
import MainLayout from "@/layouts/MainLayout";
import { Button, Col, Container, Form, Pagination, Row, Table, Spinner } from "react-bootstrap";
import Swal from 'sweetalert2';
import { API_URL } from '@/config/constants';
import { getRequestOptions, postRequestOptions } from '@/utils/Fetch';

interface FormDataType {
    idSkills?: number
    skillName: string
}

interface FilterProps {
    idSkills: string
    skillName: string
    orderBy: string
    orderType: string
    page: number
    pageSize: number
}

function Skill() {

    const [formData, setFormData] = useState<FormDataType>({
        skillName: '',
    });

    const [filter, setFilter] = useState<FilterProps>({
        idSkills: '',
        skillName: '',
        orderBy: 'idSkills',
        orderType: 'ASC',
        page: 1,
        pageSize: 10
    });


    const [total, setTotal] = useState<number>(0);
    const [totalPages, setTotalPages] = useState<number>(1);
    const [skillList, setSkillList] = useState<FormDataType[]>([]);
    const [reload, setReload] = useState<boolean>(true);
    const [loading, setLoading] = useState<boolean>(false);

    useEffect(() => {
        const fetchProjectCategoryList = async () => {
            const query = new URLSearchParams(filter as any).toString();
            try {
                const res = await fetch(`/api/skills/list?${query}`, getRequestOptions());
                const data = await res.json();
                if (res.status === 200) {
                    setSkillList(data.data);
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
        fetchProjectCategoryList();
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

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        Swal.fire({
            title: 'Are you sure?',
            text: "You want to create this skill!",
            icon: 'warning',
            showCancelButton: true,
            cancelButtonText: 'No',
            confirmButtonText: 'Yes'
        }).then(async (result) => {
            if (result.value) {
                try {
                    const res = await fetch(API_URL + 'api/skills/create', postRequestOptions(formData));
                    if (res.status === 200) {
                        Swal.fire({
                            icon: 'success',
                            title: 'Success',
                            text: (await res.json()).message,
                        });
                        setReload(true);
                        setFormData({
                            skillName: '',
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
                        <h4 className="text-start">Skills</h4>
                        <hr />
                        <Form onSubmit={handleSubmit}>
                            <Form.Group as={Row}>
                                <Form.Label column sm='4' className='mb-3'>Skill Name<span className='text-danger'>*</span></Form.Label>
                                <Col sm='8'>
                                    <Form.Control type="text" name="skillName" value={formData.skillName} onChange={(e) => setFormData({ ...formData, skillName: e.target.value })} required />
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
                <h4 className="text-start">Skills List</h4>
                <hr />
                <Table responsive striped bordered hover>
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Skill Name</th>
                            {/* <th>Actions</th> */}
                        </tr>
                        <tr>
                            <td>
                                <input type="number" className="form-control form-control-sm" placeholder="Search" name="idSkills" onChange={handleInputOnChange} value={filter.idSkills} />
                            </td>
                            <td>
                                <input type="text" className="form-control form-control-sm" placeholder="Search" name="skillName" onChange={handleInputOnChange} value={filter.skillName} />
                            </td>
                            {/* <td></td> */}

                        </tr>
                    </thead>
                    <tbody>
                        {skillList.length > 0 ? skillList.map((skill, index) => (
                            <tr key={index}>
                                <td>{skill.idSkills}</td>
                                <td>{skill.skillName}</td>
                                {/* <td>
                                    <Button variant="primary" size="sm" onClick={handleEditChange(project)}>Edit</Button>
                                </td> */}
                            </tr>
                        )) : (
                            <tr>
                                <td colSpan={2} className="text-center">No Skill found</td>
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

export default Skill;

Skill.getLayout = function PageLayout(page: any) {
    return (
        <MainLayout>
            {page}
        </MainLayout>
    )
}