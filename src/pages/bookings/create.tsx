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
import { API_URL } from "@/config/constants";
import Select, { MultiValue, SingleValue } from "react-select";
import Swal from "sweetalert2";

interface InvestorType {
    idUsers: number;
    fullName: string;
    label: string;
    value: number;
    phoneNumber: string;
}

interface ProjectPartnerSelectOption {
    value: number;
    label: string;
}

interface ProjectPartnerType {
    idProjectPartners: number;
    partnerUnitCapacity: number;
    User: {
        idUsers: number;
        fullName: string;
        phoneNumber: string;
    };
}

interface ProjectCategoryType {
    idProjectCategories: number;
    categoryName: string;
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
    ProjectCategory: ProjectCategoryType;
    ProjectPartners: ProjectPartnerType[];
}

interface FormProjectType {
    idProjects: number;
    unitPurchased: number;
    projectPartners: ProjectPartnerSelectOption[];
    uid: string; // unique identifier for each row
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

    const [showModal, setShowModal] = useState(false);
    const [modalProject, setModalProject] = useState<{
        idProjects: number | null;
        unitPurchased: number;
        projectPartners: ProjectPartnerSelectOption[];
    }>({ idProjects: null, unitPurchased: 0, projectPartners: [] });

    useEffect(() => {
        fetchInvestors();
        fetchProjectsForInvestment();
    }, []);

    const fetchInvestors = async () => {
        try {
            const res = await fetch(API_URL + "api/user/investors");
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
                setProjects(data.data);
            } else {
                Swal.fire({ icon: "error", title: "Error", text: data.message });
            }
        } catch {
            Swal.fire({ icon: "error", title: "Error", text: "Something went wrong!" });
        }
    };

    const handleOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleModalProjectChange = (
        field: "idProjects" | "projectPartners",
        value: any
    ) => {
        const updated = { ...modalProject, [field]: value } as typeof modalProject;
        if (field === "projectPartners") {
            updated.unitPurchased = (value as ProjectPartnerSelectOption[]).length;
        }
        setModalProject(updated);
    };

    const handleOpenModal = () => {
        setShowModal(true);
        setModalProject({ idProjects: null, unitPurchased: 0, projectPartners: [] });
    };

    const handleAddProject = () => {
        if (!modalProject.idProjects || modalProject.projectPartners.length === 0) {
            Swal.fire({
                icon: "warning",
                title: "Select a project and at least one partner.",
            });
            return;
        }

        const newEntry: FormProjectType = {
            idProjects: modalProject.idProjects,
            unitPurchased: modalProject.unitPurchased,
            projectPartners: modalProject.projectPartners,
            uid: `${modalProject.idProjects}-${Date.now()}`, // generate unique uid
        };

        setFormData((prev) => ({
            ...prev,
            projects: [...prev.projects, newEntry],
        }));
        setShowModal(false);
        setModalProject({ idProjects: null, unitPurchased: 0, projectPartners: [] });
    };

    const handleRemoveProject = (uid: string) => {
        setFormData((prev) => ({
            ...prev,
            projects: prev.projects.filter((p) => p.uid !== uid),
        }));
    };

    return (
        <Container>
            <Row>
                <Col md={2} />
                <Col md={8}>
                    <h4 className="text-start">Manual Booking Create</h4>
                    <hr />
                    <Form>
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
                            <Col md={12} className="text-end">
                                <Button variant="success" onClick={handleOpenModal}>
                                    Add Project
                                </Button>
                            </Col>
                        </Row>

                        <Row>
                            <Table striped bordered hover className="mt-3">
                                <thead>
                                    <tr>
                                        <th>Sl</th>
                                        <th>Project</th>
                                        <th>Investment Type</th>
                                        <th>Duration</th>
                                        <th>Unit Investment Value</th>
                                        <th>Total Remaining Units</th>
                                        <th>Partners</th>
                                        <th>Units Purchased</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {formData.projects.map((project, index) => {
                                        const projData = projects.find((p) => p.idProjects === project.idProjects);
                                        return (
                                            <tr key={project.uid}>
                                                <td>{index + 1}</td>
                                                <td>{projData?.projectName || ""}</td>
                                                <td>{projData?.investmentType || ""}</td>
                                                <td>{projData?.duration || ""}</td>
                                                <td>{projData?.unitInvestmentValue || ""}</td>
                                                <td>{projData?.totalRemainingUnits || ""}</td>
                                                <td>
                                                    {project.projectPartners.map((pp, i) => (
                                                        <span key={i}>
                                                            {pp.label}
                                                            {i < project.projectPartners.length - 1 && ", "}
                                                        </span>
                                                    ))}
                                                </td>
                                                <td>{project.unitPurchased}</td>
                                                <td>
                                                    <Button
                                                        variant="danger"
                                                        size="sm"
                                                        onClick={() => handleRemoveProject(project.uid)}
                                                    >
                                                        Remove
                                                    </Button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </Table>
                        </Row>

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
                    </Form>
                </Col>
                <Col md={2} />
            </Row>

            {/* Modal for Add Project */}
            <Modal show={showModal} onHide={() => setShowModal(false)} centered>
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
                                options={projects.map((p) => ({
                                    value: p.idProjects,
                                    label: `${p.projectName} (${p.ProjectCategory.categoryName})`,
                                }))}
                                value={
                                    modalProject.idProjects
                                        ? {
                                            value: modalProject.idProjects,
                                            label:
                                                projects.find((p) => p.idProjects === modalProject.idProjects)
                                                    ?.projectName +
                                                " (" +
                                                (projects.find((p) => p.idProjects === modalProject.idProjects)
                                                    ?.ProjectCategory.categoryName || "") +
                                                ")",
                                        }
                                        : null
                                }
                                onChange={(opt: SingleValue<{ value: number; label: string }>) =>
                                    handleModalProjectChange("idProjects", opt ? opt.value : null)
                                }
                                placeholder="Select Project"
                            />
                        </Form.Group>

                        <Form.Group>
                            <Form.Label>
                                Project Partners<span className="text-danger">*</span>
                            </Form.Label>
                            <Select
                                isMulti
                                options={
                                    modalProject.idProjects
                                        ? projects
                                            .find((p) => p.idProjects === modalProject.idProjects)
                                            ?.ProjectPartners.map((pt) => ({
                                                value: pt.idProjectPartners,
                                                label: `${pt.User.fullName} (${pt.partnerUnitCapacity})`,
                                            })) || []
                                        : []
                                }
                                value={modalProject.projectPartners}
                                onChange={(sel: MultiValue<ProjectPartnerSelectOption>) =>
                                    handleModalProjectChange("projectPartners", sel)
                                }
                                placeholder="Select Partners"
                            />
                        </Form.Group>

                        <Form.Group>
                            <Form.Label>
                                Unit Purchased<span className="text-danger">*</span>
                            </Form.Label>
                            <Form.Control
                                type="number"
                                min={modalProject.projectPartners.length}
                                value={modalProject.unitPurchased}
                                disabled
                            />
                        </Form.Group>
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
