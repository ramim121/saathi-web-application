import React, { useState, useEffect } from "react";
import MainLayout from "@/layouts/MainLayout";
import { Container, Table, Button } from "react-bootstrap";
import { getRequestOptions } from "@/utils/Fetch";
import Link from "next/link";
import Swal from "sweetalert2";

interface ListProps {
    idProjects: number,
    projectName: string,
    returnRangeMin: number,
    returnRangeMax: number,
    investmentType: string,
    returnType: string,
    duration: number,
    tenure: string,
    location: string,
    unitInvestmentValue: number,
    projectStatus: string,
    ProjectPartners: {
        User: {
            fullName: string
        }
    }[],
    CreatedBy: {
        fullName: string
    }

}

function List() {
    const [projectsList, setProjectsList] = useState<ListProps[]>([]);

    useEffect(() => {
        const fetchProjectsList = async () => {
            try {
                const res = await fetch('/api/projects/list', getRequestOptions());
                const data = await res.json();
                if (res.status === 200) {
                    setProjectsList(data.data);
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
        fetchProjectsList();
    }, []);

    return (
        <Container>
            <h2 className="text-center">Projects List</h2>
            <hr />
            <Table responsive striped bordered hover>
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Project Name</th>
                        <th>Investment Type</th>
                        <th>Return Type</th>
                        <th>Share / Unit</th>
                        <th>Return</th>
                        <th>Tenure</th>
                        <th>Location</th>
                        <th>Partner</th>
                        <th>Created By</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {projectsList.length > 0 ? projectsList.map((project, index) => (
                        <tr key={index}>
                            <td>{index + 1}</td>
                            <td>{project.projectName}</td>
                            <td>{project.investmentType.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}</td>
                            <td>{project.returnType}</td>
                            <td>{project.unitInvestmentValue}</td>
                            <td>
                                {project.returnType === 'Fixed' ? `${project.returnRangeMin}%` : `${project.returnRangeMin}% - ${project.returnRangeMax}%`}
                            </td>
                            <td>{project.duration} {project.tenure}</td>
                            <td>{project.location}</td>
                            <td>
                                <ul>
                                    {project.ProjectPartners && project.ProjectPartners.map((partner, index) => (
                                        <li key={index}>{partner.User.fullName}</li>
                                    ))}
                                </ul>
                            </td>
                            <td>{project.CreatedBy?.fullName}</td>
                            <td>
                                <Link href={`/projects/details/${project.idProjects}`}>
                                    <Button variant="primary">Details</Button>
                                </Link>
                            </td>
                        </tr>
                    )) : (
                        <tr>
                            <td colSpan={11} className="text-center">No projects found</td>
                        </tr>
                    )}

                </tbody>
            </Table>
        </Container>
    )

}

export default List;

List.getLayout = function PageLayout(page: any) {
    return (
        <MainLayout>
            {page}
        </MainLayout>
    )
}