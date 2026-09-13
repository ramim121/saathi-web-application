import React, { useState, useEffect } from "react";
import MainLayout from "@/layouts/MainLayout";
import {
    Button,
    Col,
    Container,
    Form,
    Modal,
    Row,
    Spinner,
    Table,
} from "react-bootstrap";
import { API_URL } from '@/config/public';
import Select, { SingleValue } from "react-select";
import Swal from "sweetalert2";
import { getRequestOptions, postRequestOptions } from "@/utils/Fetch";


interface InvestorType {
    idUsers: number;
    fullName: string;
    label: string;
    value: number;
    phoneNumber: string;
}


interface ProjectPartnerType {
    idProjectPartners: number;
    partnerUnitCapacity: number;
    User: {
        idUsers: number;
        fullName: string;
        phoneNumber: string;
    };
    investedUnit: number;
    amountInvested: number;
}

interface ProjectCategoryType {
    idProjectCategories: number;
    categoryName: string;
}

interface ProjectDataType {
    idProjects: number;
    location: string;
    duration: string;
    tenure: string;
    investmentType: string;
    projectName: string;
    projectStatus: string;
    projectType: string;
    returnRangeMin: number;
    returnRangeMax: number;
    unitInvestmentValue: number;
    totalAvailableUnits: number;
    totalInvestedUnits: number;
    totalRemainingUnits: number;
    label: string;
    value: number;
    ProjectCategory: ProjectCategoryType;
}

interface FormProjectType {
    idProjects: number | null;
    unitPurchased: number;
    project: ProjectDataType | null;
    projectPartners: {
        idProjectPartners: number;
        investedUnit: number;
        amountInvested: number;
        User: {
            idUsers: number;
            fullName: string;
            phoneNumber: string;
        };
    }[];
}

interface FormDataType {
    investmentDate: string;
    investor: InvestorType;
    projects: FormProjectType[];
}

function Create() {
    const [formData, setFormData] = useState<FormDataType>({
        investmentDate: "",
        investor: {
            idUsers: 0,
            fullName: "",
            label: "",
            value: 0,
            phoneNumber: "",
        },
        projects: [],
    });
    const [loading, setLoading] = useState<boolean>(false);
    const [investors, setInvestors] = useState<InvestorType[]>([]);
    const [projects, setProjects] = useState<ProjectDataType[]>([]);
    const [projectPartners, setProjectPartners] = useState<ProjectPartnerType[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [modalProject, setModalProject] = useState<{
        project: ProjectDataType | null;
        projectPartners: ProjectPartnerType[] | [];
    }>({ project: null, projectPartners: [] });

    useEffect(() => {
        fetchInvestors();
        fetchProjectsForInvestment();
    }, []);

    useEffect(() => {
        if (modalProject.project) {
            fetchProjectPartners(modalProject.project.idProjects);
        }
    }, [modalProject.project]);

    const fetchInvestors = async () => {
        try {
            // Sends the admin token: `user/investors` returns the investor list
            // and was locked to admin, so a tokenless call now 401s and this
            // page showed "Authentication required" instead of the dropdown.
            const res = await fetch(API_URL + "api/user/investors", getRequestOptions());
            const data = await res.json();
            if (res.status === 200) {
                setInvestors(data.data);
            } else {
                Swal.fire({ icon: "error", title: "Error", text: data.message });
            }
        } catch {
            Swal.fire({ icon: "error", title: "Error", text: "Something went wrong!" });
        }
    };

    const fetchProjectsForInvestment = async () => {
        try {
            const res = await fetch(API_URL + "api/projects/get_projects_for_investment");
            const data = await res.json();
            if (res.status === 200) {
                setProjects(
                    data.data.map((project: any) => ({
                        idProjects: project.idProjects,
                        location: project.location,
                        duration: project.duration,
                        tenure: project.tenure,
                        investmentType: project.investmentType,
                        projectName: project.projectName,
                        projectStatus: project.projectStatus,
                        projectType: project.projectType,
                        returnRangeMin: project.returnRangeMin,
                        returnRangeMax: project.returnRangeMax,
                        unitInvestmentValue: project.unitInvestmentValue,
                        totalAvailableUnits: project.totalAvailableUnits,
                        totalInvestedUnits: project.totalInvestedUnits,
                        totalRemainingUnits: project.totalRemainingUnits,
                        label: project.projectName,
                        value: project.idProjects,
                        ProjectCategory: project.ProjectCategory,
                    }))
                );
            } else {
                Swal.fire({ icon: "error", title: "Error", text: data.message });
            }
        } catch {
            Swal.fire({ icon: "error", title: "Error", text: "Something went wrong!" });
        }
    };

    const fetchProjectPartners = async (projectId: number) => {
        try {
            const res = await fetch(`${API_URL}api/projects/project-partners/${projectId}`);
            const data = await res.json();
            if (res.status === 200) {
                setProjectPartners(
                    data.data.map((partner: any) => ({
                        idProjectPartners: partner.idProjectPartners,
                        partnerUnitCapacity: partner.partnerUnitCapacity,
                        User: {
                            idUsers: partner.User.idUsers,
                            fullName: partner.User.fullName,
                            phoneNumber: partner.User.phoneNumber,
                        },
                        label: `${partner.User.fullName} (${partner.partnerUnitCapacity})`,
                        value: partner.idProjectPartners
                    }))
                );
            } else {
                Swal.fire({ icon: "error", title: "Error", text: data.message });
            }
        }
        catch {
            Swal.fire({ icon: "error", title: "Error", text: "Something went wrong!" });
        }
    };

    const handleOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleOpenModal = () => {
        setShowModal(true);
        setModalProject({ project: null, projectPartners: [] });
    };

    const handleAddProject = () => {
        if (!modalProject.project || modalProject.projectPartners.length === 0) {
            Swal.fire({
                icon: "warning",
                title: "Select a project and at least one partner.",
            });
            return;
        }
        const existingProject = formData.projects.find(
            (p) => p.idProjects === modalProject.project?.idProjects
        );
        if (existingProject) {
            Swal.fire({
                icon: "warning",
                title: "Project already added.",
                text: "Please select a different project.",
            });
            return;
        }
        const newProject: FormProjectType = {
            idProjects: modalProject.project.idProjects,
            unitPurchased: modalProject.projectPartners.reduce(
                (sum, pp) => sum + (pp.investedUnit || 0),
                0
            ),
            project: modalProject.project,
            projectPartners: modalProject.projectPartners.map((pp) => ({
                idProjectPartners: pp.idProjectPartners,
                investedUnit: pp.investedUnit,
                amountInvested: pp.amountInvested,
                User: {
                    idUsers: pp.User.idUsers,
                    fullName: pp.User.fullName,
                    phoneNumber: pp.User.phoneNumber,
                },
            })),
        };
        setFormData((prev) => ({
            ...prev,
            projects: [...prev.projects, newProject],
        }));
        setShowModal(false);
        setModalProject({ project: null, projectPartners: [] });
    };

    const handleRemoveProject = (index: number) => {
        setFormData((prev) => {
            const updatedProjects = [...prev.projects];
            updatedProjects.splice(index, 1);
            return { ...prev, projects: updatedProjects };
        });

    }

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!formData.investmentDate || !formData.investor.idUsers || formData.projects.length === 0) {
            Swal.fire({
                icon: "warning",
                title: "Please fill all required fields.",
            });
            return;
        }
        setLoading(true);
        try {
            const res = await fetch(API_URL + "api/bookings/manual_booking", postRequestOptions(formData));
            const data = await res.json();
            if (res.status === 200) {
                Swal.fire({
                    icon: "success",
                    title: "Booking created successfully!",
                    text: `Booking ID: ${data.data.bookingId}`,
                });
                setFormData({
                    investmentDate: "",
                    investor: {
                        idUsers: 0,
                        fullName: "",
                        label: "",
                        value: 0,
                        phoneNumber: "",
                    },
                    projects: [],
                });
            } else {
                Swal.fire({ icon: "error", title: "Error", text: data.message });
            }
        } catch (error) {
            Swal.fire({ icon: "error", title: "Error", text: "Something went wrong!" });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Container>
            <Row>
                <Col md={2} />
                <Col md={8}>
                    <h4 className="text-start">Manual Booking Create</h4>
                    <hr />
                    <Form onSubmit={handleSubmit}>
                        <Row>
                            <Col md={12}>
                                <Form.Group as={Row}>
                                    <Form.Label column sm="4" className="mb-3">
                                        Investment Date<span className="text-danger">*</span>
                                    </Form.Label>
                                    <Col sm="8">
                                        <Form.Control
                                            type="date"
                                            name="investmentDate"
                                            onChange={handleOnChange}
                                            value={formData.investmentDate}
                                        />
                                    </Col>
                                </Form.Group>
                            </Col>
                            <Col md={12}>
                                <Form.Group as={Row}>
                                    <Form.Label column sm="4" className="mb-3">
                                        Investor<span className="text-danger">*</span>
                                    </Form.Label>
                                    <Col sm="8">
                                        <Select
                                            options={investors.map((inv) => ({
                                                idUsers: inv.idUsers,
                                                fullName: inv.fullName,
                                                label: `${inv.fullName} (${inv.phoneNumber})`,
                                                value: inv.idUsers,
                                                phoneNumber: inv.phoneNumber,
                                            }))}
                                            name="investor"
                                            isSearchable
                                            isClearable
                                            placeholder="Select investor"
                                            onChange={(e: SingleValue<InvestorType>) =>
                                                setFormData({
                                                    ...formData,
                                                    investor: e
                                                        ? {
                                                            idUsers: e.idUsers,
                                                            fullName: e.fullName,
                                                            label: e.label,
                                                            value: e.value,
                                                            phoneNumber: e.phoneNumber,
                                                        }
                                                        : {
                                                            idUsers: 0,
                                                            fullName: "",
                                                            label: "",
                                                            value: 0,
                                                            phoneNumber: "",
                                                        },
                                                })
                                            }
                                            value={formData.investor.idUsers ? formData.investor : null}
                                        />
                                    </Col>
                                </Form.Group>
                            </Col>
                        </Row>
                        <Row>
                            <Table striped bordered hover className="mt-3">
                                <thead>
                                    <tr>
                                        <th>Sl</th>
                                        <th>Project</th>
                                        <th>Unit Purchased</th>
                                        <th>Project Partners</th>
                                        <th>Amount Invested</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {formData.projects.length > 0 ? formData.projects.map((project, index) => {
                                        const totalInvested = project.projectPartners.reduce(
                                            (sum, pp) => sum + (pp.amountInvested || 0),
                                            0
                                        );
                                        return (
                                            <tr key={index}>
                                                <td>{index + 1}</td>
                                                <td>{project.project?.projectName}</td>
                                                <td>{project.unitPurchased}</td>
                                                <td>
                                                    {project.projectPartners.map((pp, idx) => (
                                                        <div key={idx}>
                                                            {pp.User.fullName} ({pp.investedUnit} units)
                                                        </div>
                                                    ))}
                                                </td>
                                                <td>{totalInvested.toLocaleString()}</td>
                                                <td>
                                                    <Button
                                                        variant="outline-danger"
                                                        size="sm"
                                                        onClick={() => handleRemoveProject(index)}
                                                    >
                                                        Remove
                                                    </Button>
                                                </td>
                                            </tr>
                                        );
                                    }
                                    ) : (
                                        <tr>
                                            <td colSpan={6} className="text-center text-muted">
                                                No projects added.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <th colSpan={2} className="text-end">Total</th>
                                        <th>
                                            {formData.projects.reduce(
                                                (sum, project) => sum + (Number(project.unitPurchased) || 0),
                                                0
                                            )}
                                        </th>
                                        <th></th>
                                        <th>
                                            {formData.projects.reduce(
                                                (sum, project) =>
                                                    sum +
                                                    project.projectPartners.reduce(
                                                        (ppSum, pp) => ppSum + (pp.amountInvested || 0),
                                                        0
                                                    ),
                                                0
                                            ).toLocaleString()}
                                        </th>
                                        <th></th>
                                    </tr>
                                </tfoot>
                            </Table>
                        </Row>
                        <Row>
                            <Col md={12} className="text-end">
                                <Button variant="success" onClick={handleOpenModal}>
                                    Add Project
                                </Button>
                            </Col>
                        </Row>
                        {formData.projects.length > 0 &&
                            <Row className="justify-content-center">
                                <Button className="w-25" variant="primary" type="submit" disabled={loading}>
                                    {loading && (
                                        <Spinner
                                            as="span"
                                            animation="grow"
                                            size="sm"
                                            role="status"
                                            aria-hidden="true"
                                        />
                                    )}
                                    {loading ? "Submitting..." : "Submit"}
                                </Button>
                            </Row>
                        }
                        {/* <pre>{JSON.stringify(formData, null, 2)}</pre> */}
                    </Form>
                </Col>
                <Col md={2} />
            </Row>
            {/* Modal for Add Project */}
            <Modal show={showModal} onHide={() => setShowModal(false)} centered size="lg">
                <Modal.Header closeButton>
                    <Modal.Title>Invest in Project</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form>
                        <Form.Group>
                            <Form.Label>
                                Select Project<span className="text-danger">*</span>
                            </Form.Label>
                            <Select
                                options={projects}
                                isSearchable
                                isClearable
                                value={modalProject.project}
                                onChange={(e: SingleValue<ProjectDataType>) =>
                                    setModalProject({ project: e || null, projectPartners: [] })
                                }
                                placeholder="Select Project"
                            />
                        </Form.Group>
                        <Form.Group className="mt-2">
                            <Form.Label>
                                Select Partners & Units
                            </Form.Label>
                            <div>
                                <Button
                                    variant="outline-primary"
                                    size="sm"
                                    className="mb-2"
                                    onClick={() => {
                                        // Add a new empty partner row
                                        setModalProject((prev) => ({
                                            ...prev,
                                            projectPartners: [
                                                ...prev.projectPartners,
                                                {
                                                    idProjectPartners: 0,
                                                    partnerUnitCapacity: 0,
                                                    User: { idUsers: 0, fullName: "", phoneNumber: "" },
                                                    investedUnit: 0,
                                                    amountInvested: 0

                                                } as any,
                                            ],
                                        }));
                                    }}
                                    disabled={!projectPartners.length}
                                >
                                    Add Partner
                                </Button>
                                <Table bordered size="sm">
                                    <thead>
                                        <tr>
                                            <th>Partner</th>
                                            <th>Unit Purchased</th>
                                            <th>Amount Invested</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {modalProject.projectPartners && modalProject.projectPartners.length > 0 ? (
                                            modalProject.projectPartners.map((pp, idx) => (
                                                <tr key={idx}>
                                                    <td style={{ minWidth: 220 }}>
                                                        <Select
                                                            options={projectPartners}
                                                            value={
                                                                pp.idProjectPartners
                                                                    ? projectPartners.find(
                                                                        (p) => p.idProjectPartners === pp.idProjectPartners
                                                                    ) || null
                                                                    : null
                                                            }
                                                            onChange={(selected: SingleValue<ProjectPartnerType>) => {
                                                                setModalProject((prev) => {
                                                                    const updated = [...prev.projectPartners];
                                                                    updated[idx] = {
                                                                        ...updated[idx],
                                                                        ...(selected || {
                                                                            idProjectPartners: 0,
                                                                            partnerUnitCapacity: 0,
                                                                            User: { idUsers: 0, fullName: "", phoneNumber: "" },
                                                                        }),
                                                                    };
                                                                    return { ...prev, projectPartners: updated };
                                                                });
                                                            }}
                                                            placeholder="Select Partner"
                                                        />
                                                    </td>
                                                    <td style={{ minWidth: 120 }}>
                                                        <Form.Control
                                                            type="number"
                                                            max={pp.partnerUnitCapacity}
                                                            value={pp.investedUnit}
                                                            onChange={(e) => {
                                                                let units = Number(e.target.value);
                                                                setModalProject((prev) => {
                                                                    const updated = [...prev.projectPartners];
                                                                    updated[idx] = { ...updated[idx], investedUnit: units, amountInvested: units * (modalProject.project?.unitInvestmentValue || 0) };
                                                                    return { ...prev, projectPartners: updated };
                                                                });
                                                            }}
                                                        />
                                                        <small className="text-muted">
                                                            Max: {pp.partnerUnitCapacity ?? 1}
                                                        </small>
                                                    </td>
                                                    <td style={{ minWidth: 120 }}>
                                                        <Form.Control
                                                            type="number"
                                                            value={pp.amountInvested}
                                                            disabled
                                                        />
                                                        <small className="text-muted">
                                                            Unit Value: {modalProject.project?.unitInvestmentValue || 0}
                                                        </small>
                                                    </td>
                                                    <td>
                                                        <Button
                                                            variant="outline-danger"
                                                            size="sm"
                                                            onClick={() => {
                                                                setModalProject((prev) => ({
                                                                    ...prev,
                                                                    projectPartners: prev.projectPartners.filter((_, i) => i !== idx),
                                                                }));
                                                            }}
                                                        >
                                                            Remove
                                                        </Button>
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={4} className="text-center text-muted">
                                                    No partners added.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                    <tfoot>
                                        <tr>
                                            <th>Total</th>
                                            <th>
                                                {modalProject.projectPartners.reduce(
                                                    (sum, pp) => sum + (Number(pp.investedUnit) || 0),
                                                    0
                                                )}
                                            </th>
                                            <th>
                                                {modalProject.projectPartners.reduce(
                                                    (sum, pp) =>
                                                        sum +
                                                        ((modalProject.project?.unitInvestmentValue || 0) *
                                                            (Number(pp.investedUnit) || 0)),
                                                    0
                                                )}
                                            </th>
                                            <th></th>
                                        </tr>
                                    </tfoot>
                                </Table>
                            </div>
                        </Form.Group>
                        <Form.Group className="mt-2">
                            <Form.Label>
                                Return range
                            </Form.Label>
                            <Form.Control
                                name="return"
                                type="text"
                                value={modalProject.project ? `${modalProject.project.returnRangeMin}% - ${modalProject.project.returnRangeMax}%` : ''}
                                disabled
                            />
                        </Form.Group>
                        <Form.Group className="mt-2">
                            <Form.Label>Total Return</Form.Label>
                            <Form.Control
                                name="totalReturn"
                                type="text"
                                value={
                                    modalProject.project
                                        ? (() => {
                                            const totalInvested = modalProject.projectPartners.reduce(
                                                (sum, pp) =>
                                                    sum +
                                                    ((modalProject.project?.unitInvestmentValue || 0) *
                                                        (Number(pp.investedUnit) || 0)),
                                                0
                                            );
                                            const minReturn =
                                                totalInvested +
                                                (totalInvested * (modalProject.project.returnRangeMin || 0)) / 100;
                                            const maxReturn =
                                                totalInvested +
                                                (totalInvested * (modalProject.project.returnRangeMax || 0)) / 100;
                                            if (!totalInvested) return "";
                                            return `${minReturn.toLocaleString()} - ${maxReturn.toLocaleString()}`;
                                        })()
                                        : ""
                                }
                                disabled
                            />
                        </Form.Group>
                        <Form.Group className="mt-2">
                            <Form.Label>
                                Duration
                            </Form.Label>
                            <Form.Control
                                name="duration"
                                type="text"
                                value={modalProject.project ? `${modalProject.project.duration} ${modalProject.project.tenure}` : ''}
                                disabled
                            />
                        </Form.Group>
                        <Form.Group className="mt-2">
                            <Form.Label>
                                Location
                            </Form.Label>
                            <Form.Control
                                name="location"
                                type="text"
                                value={modalProject.project ? modalProject.project.location : ''}
                                disabled
                            />
                        </Form.Group>
                        {/* <pre>{JSON.stringify(modalProject, null, 2)}</pre> */}
                    </Form>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowModal(false)}>
                        Cancel
                    </Button>
                    <Button variant="primary" onClick={handleAddProject}>
                        Add
                    </Button>
                </Modal.Footer>
            </Modal>
        </Container>
    );
}

export default Create;

Create.getLayout = function PageLayout(page: React.ReactNode) {
    return <MainLayout>{page}</MainLayout>;
};