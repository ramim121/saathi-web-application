import React, { useState, useEffect } from "react";
import MainLayout from "@/layouts/MainLayout";
import { Container, Table, Button, Pagination } from "react-bootstrap";
import { getRequestOptions } from "@/utils/Fetch";
import Link from "next/link";
import Swal from "sweetalert2";
import { S3_URL } from '@/config/public';

interface ListProps {
	idUsers: string,
	fullName: string,
	phoneNumber: string,
	age: string,
	location: string,
	role: string,
	joiningDate: string,
	skills: string,
	disability: string,
	partnerType: string,
	ProfilePicture: {
		fileName: string,
		originalFileName: string
	},
	Partnerships: {
		partnerUnitCapacity: string,
		alreadyInvestedUnits: string,
		Project: {
			projectName: string
		}
	}[],
	PartnerAdditionalInfo?: {
		gender: 'Male' | 'Female' | 'Other',
		household_size: string,
		dependents_size: string,
		livelihood_activity: string,
		primary_goal: string
	}
}

interface FilterProps {
	fullName: string,
	phoneNumber: string,
	age: string,
	location: string,
	role: string,
	joiningDate: string,
	skills: string,
	idUsers: string,
	disability: string,
	partnerType: string,
	gender: string,
	orderBy: string,
	orderType: string,
	page: number,
	pageSize: number
}

function List() {
	const [partnersList, setPartnersList] = useState<ListProps[]>([]);
	const [filter, setFilter] = useState<FilterProps>({
		fullName: '',
		phoneNumber: '',
		age: '',
		location: '',
		role: '',
		joiningDate: '',
		skills: '',
		idUsers: '',
		disability: '',
		partnerType: '',
		gender: '',
		orderBy: 'idUsers',
		orderType: 'DESC',
		page: 1,
		pageSize: 10

	});
	const [total, setTotal] = useState<number>(0);
	const [totalPages, setTotalPages] = useState<number>(1);
	useEffect(() => {
		const fetchPartnersList = async () => {
			const query = new URLSearchParams(filter as any).toString();
			try {
				const res = await fetch(`/api/partners/list?${query}`, getRequestOptions());
				const data = await res.json();
				if (res.status === 200) {
					setPartnersList(data.data);
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
		fetchPartnersList();
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
			<h4 className="text-start">Partners List</h4>
			<hr />
			<Table responsive striped bordered hover>
				<thead>
					<tr>
						<th>#</th>
						<th>Profile Pic</th>
						<th>Full Name</th>
						<th>Phone Number</th>
						<th>Age</th>
						<th>Location</th>
						<th>Role</th>
						<th>Joining Date</th>
						<th>Skills</th>
						<th>Disability</th>
						<th>Partner Type</th>
						<th>Gender</th>
						<th>Household Size</th>
						<th>Dependents Size</th>
						<th>Livelihood Activity</th>
						<th>Primary Goal</th>
						<th>Affiliated Projects</th>
						<th>Unit Capacity</th>
						<th>Already Invested</th>
						<th>Actions</th>
					</tr>
					<tr>
						<td>
							<input type="number" className="form-control form-control-sm" placeholder="Search" name="idUsers" onChange={handleInputOnChange} value={filter.idUsers} />
						</td>
						<td></td>
						<td>
							<input type="text" className="form-control form-control-sm" placeholder="Search" name="fullName" onChange={handleInputOnChange} value={filter.fullName} />
						</td>
						<td>
							<input type="text" className="form-control form-control-sm" placeholder="Search" name="phoneNumber" onChange={handleInputOnChange} value={filter.phoneNumber} />
						</td>
						<td>
							<input type="text" className="form-control form-control-sm" placeholder="Search" name="age" onChange={handleInputOnChange} value={filter.age} />
						</td>
						<td>
							<input type="text" className="form-control form-control-sm" placeholder="Search" name="location" onChange={handleInputOnChange} value={filter.location} />
						</td>
						<td>
							<input type="text" className="form-control form-control-sm" placeholder="Search" name="role" onChange={handleInputOnChange} value={filter.role} />
						</td>
						<td>
							<input type="text" className="form-control form-control-sm" placeholder="Search" name="joiningDate" onChange={handleInputOnChange} value={filter.joiningDate} />
						</td>
						<td>
							<input type="text" className="form-control form-control-sm" placeholder="Search" name="skills" onChange={handleInputOnChange} value={filter.skills} />
						</td>
						<td>
							<input type="text" className="form-control form-control-sm" placeholder="Search" name="disability" onChange={handleInputOnChange} value={filter.disability} />
						</td>
						<td>
							<input type="text" className="form-control form-control-sm" placeholder="Search" name="partnerType" onChange={handleInputOnChange} value={filter.partnerType} />
						</td>
						<td>
							<input type="text" className="form-control form-control-sm" placeholder="Search" name="gender" onChange={handleInputOnChange} value={filter.gender} />
						</td>
						<td></td>
						<td></td>
						<td></td>
						<td></td>
						<td></td>
						<td></td>
						<td></td>
						<td></td>
					</tr>
				</thead>
				<tbody>
					{partnersList.length > 0 ? partnersList.map((partner, index) => (
						<tr key={index}>
							<td>{partner.idUsers}</td>
							<td>
								{partner.ProfilePicture && <img src={`${S3_URL}profile-picture/${partner.idUsers}/${partner.ProfilePicture?.fileName}`} alt={partner.ProfilePicture?.originalFileName} width={100} height={100} loading="lazy" />}

							</td>
							<td>{partner.fullName}</td>
							<td>{partner.phoneNumber}</td>
							<td>{partner.age}</td>
							<td>{partner.location}</td>
							<td>{partner.role}</td>
							<td>{partner.joiningDate}</td>
							<td>{partner.skills}</td>
							<td>{partner.disability.charAt(0).toUpperCase() + partner.disability.slice(1)}</td>
							<td>{partner.partnerType.charAt(0).toUpperCase() + partner.partnerType.slice(1)}</td>
							<td>{partner.PartnerAdditionalInfo?.gender || ''}</td>
							<td>{partner.PartnerAdditionalInfo?.household_size || ''}</td>
							<td>{partner.PartnerAdditionalInfo?.dependents_size || ''}</td>
							<td>{partner.PartnerAdditionalInfo?.livelihood_activity || ''}</td>
							<td>{partner.PartnerAdditionalInfo?.primary_goal || ''}</td>
							<td>
								<ul>
									{partner.Partnerships.map((project, index) => (
										<li key={index} style={{ whiteSpace: 'nowrap' }}>{project.Project.projectName}</li>
									))}
								</ul>
							</td>
							<td>
								<ul>
									{partner.Partnerships.map((project, index) => (
										<li key={index}>{project.partnerUnitCapacity}</li>
									))}
								</ul>
							</td>
							<td>
								<ul>
									{partner.Partnerships.map((project, index) => (
										<li key={index}>{project.alreadyInvestedUnits}</li>
									))}
								</ul>
							</td>
							<td style={{ whiteSpace: 'nowrap' }}>
								<Link href={`/partners/details/${partner.idUsers}`}>
									<Button variant="primary" className="me-2">Details</Button>
								</Link>
								<Link href={`/partners/edit/${partner.idUsers}`}>
									<Button variant="info">Edit</Button>
								</Link>
							</td>
						</tr>
					)) : (
						<tr>
							<td colSpan={20} className="text-center">No partners found</td>
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