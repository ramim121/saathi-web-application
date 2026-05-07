import React, { useState, useEffect } from "react";
import { Container, Form, Row, Col, Button, Card, Table } from "react-bootstrap";
import MainLayout from "@/layouts/MainLayout";
import { getRequestOptions, postRequestOptions, deleteRequestOptions } from "@/utils/Fetch";
import { API_URL } from '@/config/constants';
import Swal from 'sweetalert2';
import Select, { components } from "react-select";
import { PersonBadge, Telephone, GeoAltFill, Calendar2CheckFill, BookmarkFill, Calendar2RangeFill } from 'react-bootstrap-icons';
import Link from "next/link";

interface PartnerProps {
	idUsers: number,
	fullName: string,
	phoneNumber: string,
	location: string,
	joiningDate: string,
	label: string,
	value: number,
	Partnerships: [
		{
			idProjectPartners: number,
			Project: {
				idProjects: number,
				projectName: string,
				location: string
			},
			partnerUnitCapacity: number,
			alreadyInvested: number,
			ProjectPartnerInvestors: [
				{
					ProjectInvestor: {
						ProjectInvestmentBooking: {
							bookingId: number,
							idProjectInvestmentBookings: number
						}
					}
				}
			]
		}
	]
}

interface ProjectProps {
	idProjects: number,
	projectName: string,
	duration: number,
	tenure: number,
	location: string,
	label: string,
	value: number
}


const CustomOptionPartner = ({ data, ...props }: { data: PartnerProps, [key: string]: any }) => (
	// @ts-expect-error This error is expected because the props are spread into the component, and the type of props is not explicitly defined.
	<components.Option {...props}>
		<PersonBadge /> Name: {data.label}
		<br />
		<Telephone /> Mobile: {data.phoneNumber}
		<br />
		<GeoAltFill /> Location: {data.location}
		<br />
		<Calendar2CheckFill /> Joining Date: {data.joiningDate}
	</components.Option>
);

const CustomOptionProject = ({ data, ...props }: { data: ProjectProps, [key: string]: any }) => (
	// @ts-expect-error This error is expected because the props are spread into the component, and the type of props is not explicitly defined.
	<components.Option {...props}>
		<BookmarkFill /> Project: {data.label}
		<br />
		<Calendar2RangeFill /> Tenure: {data.duration} {data.tenure}
		<br />
		<GeoAltFill /> Location: {data.location}
	</components.Option>
);

function PartnerAssign() {
	const [partnersList, setPartnersList] = useState<PartnerProps[]>([]);
	const [selectedPartner, setSelectedPartner] = useState<PartnerProps | null>(null);
	const [partnerUnitCapacity, setPartnerUnitCapacity] = useState<number>(0);
	const [projectList, setProjectList] = useState<ProjectProps[]>([]);
	const [selectedProject, setSelectedProject] = useState<ProjectProps | null>(null);
	const [reload, setReload] = useState<boolean>(true);

	useEffect(() => {
		const fetchPartnersList = async () => {
			try {
				const res = await fetch('/api/partners/get_partner_for_assign', getRequestOptions());
				const data = await res.json();
				if (res.status === 200) {
					const newItems = data.data.map(function (element: { fullName: string, idUsers: number }) {
						return { ...element, label: element.fullName, value: element.idUsers }
					});
					setPartnersList(newItems);
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
		if (reload) {
			fetchPartnersList();
		}
	}, [reload]);

	useEffect(() => {
		const fetchProjectsList = async () => {
			try {
				const res = await fetch(`/api/projects/get-projects-for-assign/${selectedPartner?.value}`, getRequestOptions());
				const data = await res.json();
				if (res.status === 200) {
					const newItems = data.data.map(function (element: { projectName: string, idProjects: number }) {
						return { ...element, label: element.projectName, value: element.idProjects }
					});
					setProjectList(newItems);

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
		if (selectedPartner !== null) {
			fetchProjectsList();
		}


	}, [selectedPartner]);



	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		Swal.fire({
			title: 'Are you sure?',
			text: "You want to assign this partner to this project!",
			icon: 'warning',
			showCancelButton: true,
			cancelButtonText: 'No',
			confirmButtonText: 'Yes'
		}).then((result) => {
			if (result.value) {
				try {
					const formData = {
						partner: selectedPartner?.value,
						project: selectedProject?.value,
						partnerUnitCapacity: partnerUnitCapacity
					};

					const fetchData = async () => {
						const res = await fetch(API_URL + 'api/projects/partner_assign', postRequestOptions(formData));
						if (res.status === 200) {
							Swal.fire({
								icon: 'success',
								title: 'Success',
								text: 'Partner assigned successfully!',
							});
							setSelectedPartner(null);
							setSelectedProject(null);
							setPartnerUnitCapacity(0);
							setReload(true);
						} else {
							Swal.fire({
								icon: 'error',
								title: 'Error',
								html: (await res.json()).message,
							});
						}
					};
					fetchData();

				} catch (err) {
					Swal.fire({
						icon: 'error',
						title: 'Error',
						text: 'Something went wrong!',
					});
				}
			}
		});
	}

	const handleDelete = async (id: number) => {
		Swal.fire({
			title: 'Are you sure?',
			text: "You want to delete this partnership!",
			icon: 'warning',
			showCancelButton: true,
			cancelButtonText: 'No',
			confirmButtonText: 'Yes'
		}).then((result) => {
			if (result.value) {
				try {
					const fetchData = async () => {
						const res = await fetch(API_URL + 'api/projects/delete-partner-assign/' + id, deleteRequestOptions());
						if (res.status === 200) {
							Swal.fire({
								icon: 'success',
								title: 'Success',
								text: 'Partnership deleted successfully!',
							});
							setSelectedPartner(null);
							setSelectedProject(null);
							setPartnerUnitCapacity(0);
							setReload(true);
						} else {
							Swal.fire({
								icon: 'error',
								title: 'Error',
								html: (await res.json()).message,
							});
						}
					};
					fetchData();

				} catch (err) {
					Swal.fire({
						icon: 'error',
						title: 'Error',
						text: 'Something went wrong!',
					});
				}
			}
		});
	}

	return (
		<Container fluid>
			<h4 className="text-start">Partner Assign</h4>
			<hr />
			<Form onSubmit={handleSubmit}>
				<Row>
					<Col md={8}>
						<Form.Group as={Row} className='mb-3'>
							<Form.Label column sm='4' >Select Partner <span className='text-danger'>*</span></Form.Label>
							<Col sm='8'>
								<Select
									options={partnersList}
									isSearchable
									isClearable
									placeholder='Select Partner'
									onChange={(selectedOption: any) => setSelectedPartner(selectedOption)}
									value={selectedPartner}
									components={{ Option: CustomOptionPartner }}
								/>
							</Col>
						</Form.Group>
						<Form.Group as={Row} className='mb-3'>
							<Form.Label column sm='4' >Select Project <span className='text-danger'>*</span></Form.Label>
							<Col sm='8'>
								<Select
									options={projectList}
									isSearchable
									isClearable
									placeholder='Select Project'
									components={{ Option: CustomOptionProject }}
									onChange={(selectedOption: any) => setSelectedProject(selectedOption)}
									value={selectedProject}
									isDisabled={selectedPartner === null}
								/>
							</Col>
						</Form.Group>
						<Form.Group as={Row} className='mb-3'>
							<Form.Label column sm='4' >Unit Capacity <span className='text-danger'>*</span></Form.Label>
							<Col sm='8'>
								<Form.Control type='number' value={partnerUnitCapacity} onChange={(e) => setPartnerUnitCapacity(parseInt(e.target.value))} />
							</Col>
						</Form.Group>
						<Row>
							<Col sm='4'></Col>
							<Col sm='8'>
								<Row className='justify-content-center'>
									<Button className='w-50' variant="primary" type="submit">
										Submit
									</Button>
								</Row>
							</Col>
						</Row>
					</Col>
				</Row>
				<Row>
					<Col className="pt-4" md={12}>
						<Card>
							<Card.Header>Existing Projects of Partner</Card.Header>
							<Card.Body>
								<Table size="sm">
									<thead>
										<tr>
											<th>#</th>
											<th>Project name</th>
											<th>Location</th>
											<th>Unit Capacity</th>
											<th>Already Invested</th>
											<th>Remaining Capacity</th>
											<th>Booking info</th>
											<th>Action</th>
										</tr>
									</thead>
									<tbody>
										{selectedPartner && selectedPartner.Partnerships.map((project, index: number) => (
											<tr key={index}>
												<td>{project.Project?.idProjects}</td>
												<td>{project.Project?.projectName}</td>
												<td>{project.Project?.location}</td>
												<td className="text-center">{project.partnerUnitCapacity}</td>
												<td className="text-center">{project.alreadyInvested}</td>
												<td className="text-center">{project.partnerUnitCapacity - project?.alreadyInvested}</td>
												<td>
													{project.ProjectPartnerInvestors!
														.map((investor, i, array) => {
															const bookingId = investor?.ProjectInvestor?.ProjectInvestmentBooking?.bookingId;
															const bookingUrl = `/bookings/details/${investor?.ProjectInvestor?.ProjectInvestmentBooking?.idProjectInvestmentBookings}`;
															if (bookingId) {
																return (
																	<span key={bookingId}>
																		<Link href={bookingUrl} target="_blank" rel="noopener noreferrer">
																			{bookingId}
																		</Link>
																		{i < array.length - 1 && ', '} {/* Add a comma except after the last item */}
																	</span>
																);
															}
															return null;
														})
														.filter(Boolean)}
												</td>
												<td>
													{Number(project.alreadyInvested) === 0 && <Button variant="danger" size="sm" onClick={() => handleDelete(project.idProjectPartners)}>Delete</Button>}
												</td>

											</tr>
										))}
									</tbody>
								</Table>
							</Card.Body>
						</Card>
					</Col>
				</Row>
			</Form>
		</Container>
	);
}

export default PartnerAssign;

PartnerAssign.getLayout = function PageLayout(page: any) {
	return (
		<MainLayout>
			{page}
		</MainLayout>
	)
}