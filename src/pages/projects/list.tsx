import React, { useState, useEffect } from "react";
import MainLayout from "@/layouts/MainLayout";
import { Container, Table, Button, Pagination } from "react-bootstrap";
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
	showInUpcoming: string,
	ProjectPartners: {
		User: {
			fullName: string
		}
	}[],
	CreatedBy: {
		fullName: string
	}

}

interface FilterProps {
	idProjects: string,
	projectName: string,
	returnRangeMin: string,
	returnRangeMax: string,
	investmentType: string,
	returnType: string,
	duration: string,
	location: string,
	unitInvestmentValue: string,
	projectStatus: string,
	showInUpcoming: string,
	partnersName: string,
	createdBy: string,
	orderBy: string,
	orderType: string,
	page: number,
	pageSize: number
}

function List() {
	const [projectsList, setProjectsList] = useState<ListProps[]>([]);
	const [filter, setFilter] = useState<FilterProps>({
		idProjects: '',
		projectName: '',
		returnRangeMin: '',
		returnRangeMax: '',
		investmentType: '',
		returnType: '',
		duration: '',
		location: '',
		unitInvestmentValue: '',
		projectStatus: '',
		showInUpcoming: '',
		partnersName: '',
		createdBy: '',
		orderBy: 'idProjects',
		orderType: 'DESC',
		page: 1,
		pageSize: 10

	});
	const [total, setTotal] = useState<number>(0);
	const [totalPages, setTotalPages] = useState<number>(1);

	useEffect(() => {
		const fetchProjectsList = async () => {
			const query = new URLSearchParams(filter as any).toString();
			try {
				const res = await fetch(`/api/projects/list?${query}`, getRequestOptions());
				const data = await res.json();
				if (res.status === 200) {
					setProjectsList(data.data);
					setTotal(data.total);
					setTotalPages(data.totalPages);
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
	}, [filter]);

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
						<th>Upcoming</th>
						<th>Status</th>
						<th>Created By</th>
						<th>Partner</th>
						<th>Actions</th>
					</tr>
					<tr>
						<td>
							<input type="number" className="form-control form-control-sm" placeholder="Search" name="idProjects" onChange={handleInputOnChange} value={filter.idProjects} />
						</td>
						<td>
							<input type="text" className="form-control form-control-sm" placeholder="Search" name="projectName" onChange={handleInputOnChange} value={filter.projectName} />
						</td>
						<td>
							<input type="text" className="form-control form-control-sm" placeholder="Search" name="investmentType" onChange={handleInputOnChange} value={filter.investmentType} />
						</td>
						<td>
							<input type="text" className="form-control form-control-sm" placeholder="Search" name="returnType" onChange={handleInputOnChange} value={filter.returnType} />
						</td>
						<td>
							<input type="text" className="form-control form-control-sm" placeholder="Search" name="unitInvestmentValue" onChange={handleInputOnChange} value={filter.unitInvestmentValue} />
						</td>
						<td>
							<input type="text" className="form-control form-control-sm" placeholder="Search" name="returnRangeMin" onChange={handleInputOnChange} value={filter.returnRangeMin} />
						</td>
						<td>
							<input type="text" className="form-control form-control-sm" placeholder="Search" name="duration" onChange={handleInputOnChange} value={filter.duration} />
						</td>
						<td>
							<input type="text" className="form-control form-control-sm" placeholder="Search" name="location" onChange={handleInputOnChange} value={filter.location} />
						</td>
						<td>
							<input type="text" className="form-control form-control-sm" placeholder="Search" name="showInUpcoming" onChange={handleInputOnChange} value={filter.showInUpcoming} />
						</td>
						<td>
							<input type="text" className="form-control form-control-sm" placeholder="Search" name="projectStatus" onChange={handleInputOnChange} value={filter.projectStatus} />
						</td>
						<td>
							<input type="text" className="form-control form-control-sm" placeholder="Search" name="createdBy" onChange={handleInputOnChange} value={filter.createdBy} />
						</td>
						<td>
							<input type="text" className="form-control form-control-sm" placeholder="Search" name="partnersName" onChange={handleInputOnChange} value={filter.partnersName} />
						</td>
						<td></td>

					</tr>
				</thead>
				<tbody>
					{projectsList.length > 0 ? projectsList.map((project, index) => (
						<tr key={index}>
							<td>{project.idProjects}</td>
							<td>{project.projectName}</td>
							<td>{project.investmentType.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}</td>
							<td>{project.returnType.charAt(0).toUpperCase() + project.returnType.slice(1)}</td>
							<td>{project.unitInvestmentValue}</td>
							<td>
								{project.returnType === 'Fixed' ? `${project.returnRangeMin}%` : `${project.returnRangeMin}% - ${project.returnRangeMax}%`}
							</td>
							<td>{project.duration} {project.tenure}</td>
							<td>{project.location}</td>
							<td>{project.showInUpcoming.charAt(0).toUpperCase() + project.showInUpcoming.slice(1)}</td>
							<td>{project.projectStatus.charAt(0).toUpperCase() + project.projectStatus.slice(1)}</td>
							<td>{project.CreatedBy?.fullName}</td>
							<td>
								<ul>
									{project.ProjectPartners && project.ProjectPartners.map((partner, index) => (
										<li key={index}>{partner.User.fullName}</li>
									))}
								</ul>
							</td>
							<td>
								<Link href={`/projects/details/${project.idProjects}`}>
									<Button variant="primary">Details</Button>
								</Link>
							</td>
						</tr>
					)) : (
						<tr>
							<td colSpan={13} className="text-center">No projects found</td>
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