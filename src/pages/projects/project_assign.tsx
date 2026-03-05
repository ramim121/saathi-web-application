import React, { useEffect, useState } from 'react';
import { Container, Form, Row, Col, Button, Card, Table } from 'react-bootstrap';
import MainLayout from '@/layouts/MainLayout';
import { API_URL } from '@/config/constants';
import { deleteRequestOptions, getRequestOptions, postRequestOptions } from '@/utils/Fetch';
import Swal from 'sweetalert2';
import Select, { components } from 'react-select';
import { BookmarkFill, Calendar2RangeFill, GeoAltFill, PersonBadge, Telephone } from 'react-bootstrap-icons';

interface ProjectOption {
    idProjects: number;
    projectName: string;
    duration: number;
    tenure: string;
    location: string;
    label: string;
    value: number;
}

interface PartnerOption {
    idUsers: number;
    fullName: string;
    phoneNumber: string;
    location: string;
    joiningDate: string;
    label: string;
    value: number;
}

interface AssignRow {
    partner: PartnerOption | null;
    partnerUnitCapacity: number;
}

interface ExistingProjectPartner {
    idProjectPartners: number;
    idUsers: number;
    partnerUnitCapacity: number;
    investorConfirmedBookingCount: number;
    investorAlreadyBookedCount: number;
    User: {
        fullName: string;
        phoneNumber: string;
    };
}

const CustomOptionProject = ({ data, ...props }: { data: ProjectOption; [key: string]: any }) => (
    // @ts-expect-error This error is expected because the props are spread into the component.
    <components.Option {...props}>
        <BookmarkFill /> Project: {data.label}
        <br />
        <Calendar2RangeFill /> Tenure: {data.duration} {data.tenure}
        <br />
        <GeoAltFill /> Location: {data.location}
    </components.Option>
);

const CustomOptionPartner = ({ data, ...props }: { data: PartnerOption; [key: string]: any }) => (
    // @ts-expect-error This error is expected because the props are spread into the component.
    <components.Option {...props}>
        <PersonBadge /> Name: {data.label}
        <br />
        <Telephone /> Mobile: {data.phoneNumber}
        <br />
        <GeoAltFill /> Location: {data.location}
    </components.Option>
);

function ProjectAssign() {
    const [projectList, setProjectList] = useState<ProjectOption[]>([]);
    const [selectedProject, setSelectedProject] = useState<ProjectOption | null>(null);
    const [partnersList, setPartnersList] = useState<PartnerOption[]>([]);
    const [assignRows, setAssignRows] = useState<AssignRow[]>([{ partner: null, partnerUnitCapacity: 0 }]);
    const [existingPartners, setExistingPartners] = useState<ExistingProjectPartner[]>([]);

    useEffect(() => {
        const fetchProjects = async () => {
            try {
                const res = await fetch('/api/projects/get-projects-for-project-assign', getRequestOptions());
                const data = await res.json();
                if (res.status === 200) {
                    const options = data.data.map((item: ProjectOption) => ({
                        ...item,
                        label: item.projectName,
                        value: item.idProjects
                    }));
                    setProjectList(options);
                    return;
                }
                Swal.fire({ icon: 'error', title: 'Error', text: data.message });
            } catch (error) {
                Swal.fire({ icon: 'error', title: 'Error', text: (error as Error).message });
            }
        };
        fetchProjects();
    }, []);

    useEffect(() => {
        const fetchPartnersForProject = async () => {
            if (!selectedProject) {
                setPartnersList([]);
                setExistingPartners([]);
                setAssignRows([{ partner: null, partnerUnitCapacity: 0 }]);
                return;
            }
            try {
                const [partnerRes, existingRes] = await Promise.all([
                    fetch(`/api/partners/get-partners-for-assign/${selectedProject.value}`, getRequestOptions()),
                    fetch(`/api/projects/project-partners/${selectedProject.value}`, getRequestOptions())
                ]);
                const partnerData = await partnerRes.json();
                const existingData = await existingRes.json();

                if (partnerRes.status === 200) {
                    const options = partnerData.data.map((item: PartnerOption) => ({
                        ...item,
                        label: item.fullName,
                        value: item.idUsers
                    }));
                    setPartnersList(options);
                    setAssignRows([{ partner: null, partnerUnitCapacity: 0 }]);
                } else {
                    Swal.fire({ icon: 'error', title: 'Error', text: partnerData.message });
                }

                if (existingRes.status === 200) {
                    setExistingPartners(existingData.data);
                } else {
                    Swal.fire({ icon: 'error', title: 'Error', text: existingData.message });
                }
            } catch (error) {
                Swal.fire({ icon: 'error', title: 'Error', text: (error as Error).message });
            }
        };
        fetchPartnersForProject();
    }, [selectedProject]);

    const selectedPartnerIds = assignRows
        .map((row) => row.partner?.value)
        .filter((partnerId): partnerId is number => Boolean(partnerId));

    const handleRowChange = (rowIndex: number, updatedRow: AssignRow) => {
        const nextRows = [...assignRows];
        nextRows[rowIndex] = updatedRow;
        setAssignRows(nextRows);
    };

    const addRow = () => {
        setAssignRows((prev) => [...prev, { partner: null, partnerUnitCapacity: 0 }]);
    };

    const removeRow = (rowIndex: number) => {
        setAssignRows((prev) => {
            if (prev.length === 1) {
                return prev;
            }
            return prev.filter((_, index) => index !== rowIndex);
        });
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        if (!selectedProject) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Please select a project' });
            return;
        }

        const invalidRow = assignRows.find((row) => !row.partner || !row.partnerUnitCapacity || row.partnerUnitCapacity <= 0);
        if (invalidRow) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Please select partner and add valid unit capacity for every row' });
            return;
        }

        const payload = {
            project: selectedProject.value,
            partners: assignRows.map((row) => ({
                partner: row.partner?.value,
                partnerUnitCapacity: Number(row.partnerUnitCapacity)
            }))
        };

        Swal.fire({
            title: 'Are you sure?',
            text: 'You want to assign partners to this project!',
            icon: 'warning',
            showCancelButton: true,
            cancelButtonText: 'No',
            confirmButtonText: 'Yes'
        }).then(async (result) => {
            if (!result.value) {
                return;
            }

            try {
                const res = await fetch(API_URL + 'api/projects/project_assign', postRequestOptions(payload));
                if (res.status === 200) {
                    Swal.fire({ icon: 'success', title: 'Success', text: 'Partners assigned successfully!' });
                    setAssignRows([{ partner: null, partnerUnitCapacity: 0 }]);

                    const [partnerRes, existingRes] = await Promise.all([
                        fetch(`/api/partners/get-partners-for-assign/${selectedProject.value}`, getRequestOptions()),
                        fetch(`/api/projects/project-partners/${selectedProject.value}`, getRequestOptions())
                    ]);
                    const partnerData = await partnerRes.json();
                    const existingData = await existingRes.json();
                    if (partnerRes.status === 200) {
                        const options = partnerData.data.map((item: PartnerOption) => ({
                            ...item,
                            label: item.fullName,
                            value: item.idUsers
                        }));
                        setPartnersList(options);
                    }
                    if (existingRes.status === 200) {
                        setExistingPartners(existingData.data);
                    }
                    return;
                }

                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    html: (await res.json()).message
                });
            } catch (error) {
                Swal.fire({ icon: 'error', title: 'Error', text: (error as Error).message });
            }
        });
    };

    const handleDelete = async (idProjectPartners: number) => {
        Swal.fire({
            title: 'Are you sure?',
            text: 'You want to delete this partnership!',
            icon: 'warning',
            showCancelButton: true,
            cancelButtonText: 'No',
            confirmButtonText: 'Yes'
        }).then(async (result) => {
            if (!result.value || !selectedProject) {
                return;
            }

            try {
                const res = await fetch(API_URL + `api/projects/delete-partner-assign/${idProjectPartners}`, deleteRequestOptions());
                if (res.status === 200) {
                    Swal.fire({ icon: 'success', title: 'Success', text: 'Partnership deleted successfully!' });
                    const [partnerRes, existingRes] = await Promise.all([
                        fetch(`/api/partners/get-partners-for-assign/${selectedProject.value}`, getRequestOptions()),
                        fetch(`/api/projects/project-partners/${selectedProject.value}`, getRequestOptions())
                    ]);
                    const partnerData = await partnerRes.json();
                    const existingData = await existingRes.json();
                    if (partnerRes.status === 200) {
                        const options = partnerData.data.map((item: PartnerOption) => ({
                            ...item,
                            label: item.fullName,
                            value: item.idUsers
                        }));
                        setPartnersList(options);
                    }
                    if (existingRes.status === 200) {
                        setExistingPartners(existingData.data);
                    }
                    return;
                }

                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    html: (await res.json()).message
                });
            } catch (error) {
                Swal.fire({ icon: 'error', title: 'Error', text: (error as Error).message });
            }
        });
    };

    return (
        <Container>
            <h4 className="text-start">Project Assign</h4>
            <hr />
            <Form onSubmit={handleSubmit}>
                <Row>
                    <Col md={9}>
                        <Form.Group as={Row} className="mb-3">
                            <Form.Label column sm="3">
                                Select Project <span className="text-danger">*</span>
                            </Form.Label>
                            <Col sm="9">
                                <Select
                                    options={projectList}
                                    isSearchable
                                    isClearable
                                    placeholder="Select Project"
                                    components={{ Option: CustomOptionProject }}
                                    onChange={(selectedOption: ProjectOption | null) => setSelectedProject(selectedOption)}
                                    value={selectedProject}
                                />
                            </Col>
                        </Form.Group>

                        {assignRows.map((row, index) => (
                            <Row className="mb-3" key={`assign-row-${index}`}>
                                <Col sm={7}>
                                    <Select
                                        options={partnersList.filter((partner) => {
                                            if (row.partner?.value === partner.value) {
                                                return true;
                                            }
                                            return !selectedPartnerIds.includes(partner.value);
                                        })}
                                        isSearchable
                                        isClearable
                                        isDisabled={!selectedProject || partnersList.length === 0}
                                        placeholder={`Select Partner ${index + 1}`}
                                        components={{ Option: CustomOptionPartner }}
                                        onChange={(selectedOption: PartnerOption | null) =>
                                            handleRowChange(index, {
                                                ...row,
                                                partner: selectedOption
                                            })
                                        }
                                        value={row.partner}
                                    />
                                </Col>
                                <Col sm={3}>
                                    <Form.Control
                                        type="number"
                                        min={1}
                                        placeholder="Unit Capacity"
                                        value={row.partnerUnitCapacity || ''}
                                        onChange={(e) =>
                                            handleRowChange(index, {
                                                ...row,
                                                partnerUnitCapacity: Number(e.target.value)
                                            })
                                        }
                                        disabled={!selectedProject}
                                    />
                                </Col>
                                <Col sm={2} className="d-flex gap-2">
                                    <Button
                                        variant="outline-danger"
                                        onClick={() => removeRow(index)}
                                        disabled={assignRows.length === 1}
                                    >
                                        Remove
                                    </Button>
                                </Col>
                            </Row>
                        ))}

                        <Row className="mb-3">
                            <Col sm={3} />
                            <Col sm={9} className="d-flex gap-2">
                                <Button
                                    variant="outline-primary"
                                    onClick={addRow}
                                    type="button"
                                    disabled={!selectedProject || partnersList.length === 0}
                                >
                                    Add Partner
                                </Button>
                                <Button variant="primary" type="submit" disabled={!selectedProject}>
                                    Submit
                                </Button>
                            </Col>
                        </Row>
                    </Col>
                </Row>
            </Form>

            <Row>
                <Col className="pt-4" md={12}>
                    <Card>
                        <Card.Header>Existing Partners of Selected Project</Card.Header>
                        <Card.Body>
                            <Table size="sm">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Partner Name</th>
                                        <th>Phone</th>
                                        <th>Unit Capacity</th>
                                        <th>Confirmed Bookings</th>
                                        <th>Pending Bookings</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {existingPartners.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="text-center">
                                                {selectedProject ? 'No partner assigned yet' : 'Select a project to view partners'}
                                            </td>
                                        </tr>
                                    )}
                                    {existingPartners.map((item, index) => (
                                        <tr key={item.idProjectPartners}>
                                            <td>{index + 1}</td>
                                            <td>{item.User?.fullName}</td>
                                            <td>{item.User?.phoneNumber}</td>
                                            <td className="text-center">{item.partnerUnitCapacity}</td>
                                            <td className="text-center">{item.investorConfirmedBookingCount}</td>
                                            <td className="text-center">{item.investorAlreadyBookedCount}</td>
                                            <td>
                                                {Number(item.investorConfirmedBookingCount) === 0 && (
                                                    <Button
                                                        variant="danger"
                                                        size="sm"
                                                        onClick={() => handleDelete(item.idProjectPartners)}
                                                    >
                                                        Delete
                                                    </Button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
        </Container>
    );
}

export default ProjectAssign;

ProjectAssign.getLayout = function PageLayout(page: any) {
    return <MainLayout>{page}</MainLayout>;
};
