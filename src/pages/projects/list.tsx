import React, { useState, useEffect } from "react";
import MainLayout from "@/layouts/MainLayout";
import { Container, Table, Button, Pagination } from "react-bootstrap";
import { getRequestOptions } from "@/utils/Fetch";
import Link from "next/link";
import Swal from "sweetalert2";
import { S3_URL } from '@/config/constants';

interface ListProps {
	idProjects: number,
	projectName: string,
	returnRangeMin: number,
	returnRangeMax: number,
	investmentType: string,
	duration: number,
	returnType: string,
	tenure: string,
	unitInvestmentValue: number,
	projectStatus: string,
	ProjectPartners: {
		User: {
			fullName: string
		}
	}[],
	CreatedBy: {
		fullName: string
	},
	ProjectCategory: {
		categoryName: string
	},
	totalAvailableUnits: number,
	investorUnitCapacity: number,
	alreadyInvested: number,
	totalRemainingUnits: number,
	MainImage: {
		fileName: string,
		originalFileName: string
	}
}

interface FilterProps {
	idProjects: string,
	projectName: string,
	returnRangeMin: string,
	returnRangeMax: string,
	investmentType: string,
	duration: string,
	unitInvestmentValue: string,
	projectStatus: string,
	partnersName: string,
	createdBy: string,
	categoryName: string,
	totalAvailableUnits: string,
	investorUnitCapacity: string,
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
		duration: '',
		unitInvestmentValue: '',
		projectStatus: '',
		partnersName: '',
		createdBy: '',
		categoryName: '',
		totalAvailableUnits: '',
		investorUnitCapacity: '',
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
			<h4 className="text-start">Projects List</h4>
			<hr />
			<Table responsive striped bordered hover size="sm">
				<thead>
					<tr>
						<th>#</th>
						<th>Main Image</th>
						<th>Project Name</th>
						<th>Category</th>
						<th>Investment Type</th>
						<th>Share / Unit</th>
						<th>Return</th>
						<th>Tenure</th>
						<th>Total Available Units</th>
						<th>Already Invested</th>
						<th>Remaining Units</th>
						<th>Investor Capacity</th>
						<th>Status</th>
						<th>Actions</th>
					</tr>
					<tr>
						<td>
							<input type="number" className="form-control form-control-sm" placeholder="Search" name="idProjects" onChange={handleInputOnChange} value={filter.idProjects} />
						</td>
						<td></td>
						<td>
							<input type="text" className="form-control form-control-sm" placeholder="Search" name="projectName" onChange={handleInputOnChange} value={filter.projectName} />
						</td>
						<td>
							<input type="text" className="form-control form-control-sm" placeholder="Search" name="categoryName" onChange={handleInputOnChange} value={filter.categoryName} />
						</td>
						<td>
							<input type="text" className="form-control form-control-sm" placeholder="Search" name="investmentType" onChange={handleInputOnChange} value={filter.investmentType} />
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
							<input type="text" className="form-control form-control-sm" placeholder="Search" name="totalAvailableUnits" onChange={handleInputOnChange} value={filter.totalAvailableUnits} />
						</td>
						<td></td>
						<td></td>
						<td>
							<input type="text" className="form-control form-control-sm" placeholder="Search" name="investorUnitCapacity" onChange={handleInputOnChange} value={filter.investorUnitCapacity} />
						</td>
						<td>
							<input type="text" className="form-control form-control-sm" placeholder="Search" name="projectStatus" onChange={handleInputOnChange} value={filter.projectStatus} />
						</td>
						<td></td>
					</tr>
				</thead>
				<tbody>
					{projectsList.length > 0 ? projectsList.map((project, index) => (
						<tr key={index}>
							<td>{project.idProjects}</td>
							<td>
								{project.MainImage && <img src={`${S3_URL}project-main-image/${project.idProjects}/${project.MainImage?.fileName}`} alt={project.MainImage?.originalFileName} width={100} height={100} loading="lazy" />}

							</td>
							<td>{project.projectName}</td>
							<td>{project.ProjectCategory?.categoryName}</td>
							<td>{project.investmentType.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}</td>
							<td>{project.unitInvestmentValue}</td>
							<td>
								{project.returnType === 'Fixed' ? `${project.returnRangeMin}%` : `${project.returnRangeMin}% - ${project.returnRangeMax}%`}
							</td>
							<td>{project.duration} {project.tenure}</td>
							<td>{project.totalAvailableUnits}</td>
							<td>{project.alreadyInvested}</td>
							<td>{project.totalRemainingUnits}</td>
							<td>{project.investorUnitCapacity}</td>
							<td>{project.projectStatus.charAt(0).toUpperCase() + project.projectStatus.slice(1)}</td>
							<td style={{ whiteSpace: 'nowrap' }}>
								<Link href={`/projects/details/${project.idProjects}`}>
									<Button size="sm" variant="primary" className="me-2">Details</Button>
								</Link>
								<Link href={`/projects/edit/${project.idProjects}`}>
									<Button size="sm" variant="info">Edit</Button>
								</Link>
							</td>
						</tr>
					)) : (
						<tr>
							<td colSpan={14} className="text-center">No projects found</td>
						</tr>
					)}

				</tbody>
				<tfoot>
					<tr>
						<td className="pt-2 border-0" colSpan={15}>
							<div className="d-flex w-100 justify-content-center">
								<Pagination>
									<Pagination.First onClick={() => handlePageChange(1)} disabled={filter.page === 1} />
									<Pagination.Prev onClick={() => handlePageChange(filter.page - 1)} disabled={filter.page === 1} />
									{pageList()}
									<Pagination.Next onClick={() => handlePageChange(filter.page + 1)} disabled={filter.page === totalPages} />
									<Pagination.Last onClick={() => handlePageChange(totalPages)} disabled={filter.page === totalPages} />
								</Pagination>
							</div>
						</td>
					</tr>
				</tfoot>
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