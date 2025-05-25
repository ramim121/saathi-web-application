import React, { useState, useEffect } from "react";
import MainLayout from "@/layouts/MainLayout";
import { Button, Col, Container, Form, Row, Spinner, Table } from 'react-bootstrap';
import { API_URL } from '@/config/constants';
import Select from 'react-select';
import Swal from 'sweetalert2';

interface FormDataType {
    investmentDate: string;
    investor: {
        idUsers: number;
        fullName: string;
        label: string;
        value: number;
    },
    projects: {
        idProjects: number;
        unitPurchased: number;
        projectPartners: {
            idProjectPartners: number;
            amountInvested: number;
            investedUnit: number;
        }[]
    }[]
}

interface ProjectDataType {
    idProjects: number;
    duration: string;
    tenure: string;
    investmentType: string;
    investorCount: number;
    investorUnitCapacity: number;
    projectName: string;
    projectStatus: string;
    projectType: string;
    returnRangeMin: number;
    returnRangeMax: number;
    unitInvestmentValue: number;
    totalAvailableUnits: number;
    totalInvestedUnits: number;
    totalRemainingUnits: number;
    showInUpcoming: boolean;
    location: string;
    ProjectCategory: {
        idProjectCategories: number;
        categoryName: string;
    };
    ProjectPartners: {
        idProjectPartners: number;
        partnerUnitCapacity: number;
        User: {
            idUsers: number;
            fullName: string;
            phoneNumber: string;
        }
    }[]
};

function Create() {

    const [formData, setFormData] = useState<FormDataType>({
        investmentDate: '',
        investor: {
            idUsers: 0,
            fullName: '',
            label: '',
            value: 0
        },
        projects: [{
            idProjects: 0,
            unitPurchased: 0,
            projectPartners: [{
                idProjectPartners: 0,
                amountInvested: 0,
                investedUnit: 0
            }]
        }]
    });
    const [loading, setLoading] = useState<boolean>(false);
    const [investors, setInvestors] = useState<{ idUsers: number; fullName: string; label: string; value: number; phoneNumber: string }[]>([]);
    const [projects, setProjects] = useState<ProjectDataType[]>([]);

    useEffect(() => {
        fetchInvestors();
        fetchProjectsForInvestment();
    }, []);

    const fetchInvestors = async () => {
        try {
            const res = await fetch(API_URL + 'api/user/investors');
            const data = await res.json();
            if (res.status === 200) {
                setInvestors(data.data);
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: data.message,
                });
            }
        } catch (err) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Something went wrong!',
            });
        }
    };

    const fetchProjectsForInvestment = async () => {
        try {
            const res = await fetch(API_URL + 'api/projects/get_projects_for_investment');
            const data = await res.json();
            if (res.status === 200) {
                setProjects(data.data);
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: data.message,
                });
            }
        } catch (err) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Something went wrong!',
            });
        }
    }


    const handleOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
    };

    return (
        <Container>
            <Row>
                <Col md={2}></Col>
                <Col md={8}>
                    <h4 className="text-start">Manual Booking Create</h4>
                    <hr />
                    <Form>
                        <Row>
                            <Col md={12}>
                                <Form.Group as={Row}>
                                    <Form.Label column sm='4' className='mb-3'>Investment Date<span className='text-danger'>*</span></Form.Label>
                                    <Col sm='8'>
                                        <Form.Control type="date" name="investmentDate" onChange={handleOnChange} value={formData.investmentDate} />
                                    </Col>
                                </Form.Group>
                            </Col>
                            <Col md={12}>
                                <Form.Group as={Row}>
                                    <Form.Label column sm='4' className='mb-3'>Investor<span className='text-danger'>*</span></Form.Label>
                                    <Col sm='8'>
                                        <Select
                                            options={investors.map((investor) => ({
                                                idUsers: investor.idUsers,
                                                fullName: investor.fullName,
                                                label: investor.fullName + ' (' + investor.phoneNumber + ')',
                                                value: investor.idUsers
                                            }))}
                                            name="investor"
                                            isSearchable
                                            isClearable
                                            placeholder='Select investor'
                                            onChange={(e) => setFormData({
                                                ...formData,
                                                investor: {
                                                    idUsers: e!.idUsers,
                                                    fullName: e!.fullName,
                                                    label: e!.label,
                                                    value: e!.value
                                                }
                                            })}
                                            value={formData.investor}
                                        />
                                    </Col>
                                </Form.Group>
                            </Col>
                        </Row>
                        <Row>
                            <Table striped bordered hover className='mt-3'>
                                <thead>
                                    <tr>
                                        <th>Sl</th>
                                        <th>Project</th>
                                        <th>Investment Type</th>
                                        <th>Duration</th>
                                        <th>Unit Investment Value</th>
                                        <th>Total Remaining Units</th>
                                        <th>Project Partners</th>
                                        <th>Unit Purchased</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {formData.projects.map((project, index) => (
                                        <tr key={index}>
                                            <td>{index + 1}</td>
                                            <td>
                                                <Select
                                                    options={projects.map((p) => ({
                                                        idProjects: p.idProjects,
                                                        projectName: p.projectName,
                                                        label: p.projectName + ' (' + p.ProjectCategory.categoryName + ')',
                                                        value: p.idProjects
                                                    }))}
                                                    name={`projects[${index}].idProjects`}
                                                    isSearchable
                                                    isClearable
                                                    placeholder='Select project'
                                                    onChange={(e) => {
                                                        const updatedProjects = [...formData.projects];
                                                        updatedProjects[index].idProjects = e!.idProjects;
                                                        setFormData({ ...formData, projects: updatedProjects });
                                                    }}
                                                    value={
                                                        project.idProjects
                                                            ? {
                                                                idProjects: project.idProjects,
                                                                projectName: projects.find(p => p.idProjects === project.idProjects)?.projectName || '',
                                                                label:
                                                                    (projects.find(p => p.idProjects === project.idProjects)?.projectName || '') +
                                                                    ' (' +
                                                                    (projects.find(p => p.idProjects === project.idProjects)?.ProjectCategory.categoryName || '') +
                                                                    ')',
                                                                value: project.idProjects
                                                            }
                                                            : null
                                                    }
                                                />
                                            </td>
                                            <td>{projects.find(p => p.idProjects === project.idProjects)?.investmentType}</td>
                                            <td>{projects.find(p => p.idProjects === project.idProjects)?.duration}</td>
                                            <td>{projects.find(p => p.idProjects === project.idProjects)?.unitInvestmentValue}</td>
                                            <td>{projects.find(p => p.idProjects === project.idProjects)?.totalRemainingUnits}</td>
                                            <td>
                                                <Select
                                                    isMulti
                                                    options={
                                                        projects.find(p => p.idProjects === project.idProjects)?.ProjectPartners.map((partner) => ({
                                                            label: `${partner.User.fullName} (${partner.partnerUnitCapacity})`,
                                                            value: partner.idProjectPartners,
                                                            partnerUnitCapacity: partner.partnerUnitCapacity
                                                        })) || []
                                                    }
                                                    name={`projects[${index}].projectPartners`}
                                                    placeholder="Select partners"
                                                    value={
                                                        project.projectPartners
                                                            .map(pp => {
                                                                const proj = projects.find(p => p.idProjects === project.idProjects);
                                                                const partner = proj?.ProjectPartners.find(pt => pt.idProjectPartners === pp.idProjectPartners);
                                                                return partner
                                                                    ? {
                                                                        label: `${partner.User.fullName} (${partner.partnerUnitCapacity})`,
                                                                        value: partner.idProjectPartners,
                                                                        partnerUnitCapacity: partner.partnerUnitCapacity
                                                                    }
                                                                    : null;
                                                            })
                                                            .filter(Boolean)
                                                    }
                                                    onChange={(selected) => {
                                                        const updatedProjects = [...formData.projects];
                                                        updatedProjects[index].projectPartners = (selected as any[] || []).map(sel => ({
                                                            idProjectPartners: sel.value,
                                                            amountInvested: 0,
                                                            investedUnit: 1 // default to 1 unit per selected partner
                                                        }));
                                                        updatedProjects[index].unitPurchased = updatedProjects[index].projectPartners.length;
                                                        setFormData({ ...formData, projects: updatedProjects });
                                                    }}
                                                />
                                            </td>
                                            <td>
                                                <Form.Control
                                                    type="number"
                                                    name={`projects[${index}].unitPurchased`}
                                                    value={project.unitPurchased}
                                                    onChange={(e) => {
                                                        const updatedProjects = [...formData.projects];
                                                        updatedProjects[index].unitPurchased = parseInt(e.target.value);
                                                        setFormData({ ...formData, projects: updatedProjects });
                                                    }}
                                                />
                                            </td>
                                            <td>
                                                {/* {index !== 0 &&
                                                    <Button
                                                        variant="danger"
                                                        onClick={() => {
                                                            const updatedProjects = [...formData.projects];
                                                            updatedProjects.splice(index, 1);
                                                            setFormData({ ...formData, projects: updatedProjects });
                                                        }}
                                                    >
                                                        Remove
                                                    </Button>
                                                }
                                                <Button
                                                    variant="success"
                                                    onClick={() => {
                                                        setFormData({
                                                            ...formData,
                                                            projects: [
                                                                ...formData.projects,
                                                                {
                                                                    idProjects: 0,
                                                                    unitPurchased: 0,
                                                                    projectPartners: [{
                                                                        idProjectPartners: 0,
                                                                        amountInvested: 0,
                                                                        investedUnit: 0
                                                                    }]
                                                                }
                                                            ]
                                                        });
                                                    }}
                                                >
                                                    Add Project
                                                </Button> */}

                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        </Row>
                        <Row className='justify-content-center'>
                            <Button className='w-25' variant="primary" type="submit" disabled={loading}>
                                {loading && <Spinner as="span" animation="grow" size="sm" role="status" aria-hidden="true" />}
                                {loading ? 'Submitting...' : 'Submit'}
                            </Button>
                        </Row>
                    </Form>
                </Col>
                <Col md={2}></Col>
            </Row>
            <pre>
                {JSON.stringify(formData, null, 2)}
                <br />
                {JSON.stringify(projects, null, 2)}
            </pre>
        </Container>

    )

}

export default Create;

Create.getLayout = function PageLayout(page: any) {
    return (
        <MainLayout>
            {page}
        </MainLayout>
    )
}
