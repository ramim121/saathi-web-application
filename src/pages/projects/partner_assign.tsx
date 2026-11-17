import React, { useState, useEffect } from "react";
import MainLayout from "@/layouts/MainLayout";
import { getRequestOptions, postRequestOptions, deleteRequestOptions } from "@/utils/Fetch";
import { API_URL } from '@/config/public';
import Swal from 'sweetalert2';
import ReactSelect from "react-select";
import Link from "next/link";
import { ArrowUpRight, Network, Trash2 } from "lucide-react";
import { Avatar, Card, cx } from "@/ui/primitives";
import { Button, Field, Input, Required } from "@/ui/controls";
import { EmptyRow, PageHeader, TableCard, TD, TH, TR } from "@/ui/layout";
import { selectStyles } from "@/ui/select";
import { date } from "@/ui/format";

interface PartnerProps {
	idUsers: number,
	fullName: string,
	phoneNumber: string,
	location: string,
	joiningDate: string,
	label: string,
	value: number,
	Partnerships: {
		idProjectPartners: number,
		Project: {
			idProjects: number,
			projectName: string,
			location: string
		},
		partnerUnitCapacity: number,
		alreadyInvested: number,
		ProjectPartnerInvestors: {
			ProjectInvestor: {
				ProjectInvestmentBooking: {
					bookingId: number,
					idProjectInvestmentBookings: number
				}
			}
		}[]
	}[]
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

	const partnerships = selectedPartner?.Partnerships ?? [];

	return (
		<div className="ui">
			<PageHeader
				eyebrow="Projects"
				title="Assign partners"
				description="Choose a partner, then add them to a project with the number of units they can hold. Their current projects are listed alongside."
			/>

			<div className="tw-grid tw-grid-cols-1 tw-items-start tw-gap-6 lg:tw-grid-cols-[22rem_minmax(0,1fr)]">
				<Card className="tw-p-5">
					<form onSubmit={handleSubmit} className="tw-space-y-4">
						<Field label={<>Partner<Required /></>}>
							<ReactSelect<PartnerProps>
								instanceId="partner"
								inputId="partner"
								options={partnersList}
								isSearchable
								isClearable
								placeholder="Search partners"
								styles={selectStyles<PartnerProps>()}
								onChange={(selectedOption: any) => setSelectedPartner(selectedOption)}
								value={selectedPartner}
								formatOptionLabel={(option, { context }) =>
									context === 'menu' ? (
										<div>
											<div className="tw-font-medium">{option.label}</div>
											<div className="tw-text-xs tw-text-slate-500">
												{[option.phoneNumber, option.location, option.joiningDate ? `joined ${date(String(option.joiningDate))}` : null].filter(Boolean).join(' · ')}
											</div>
										</div>
									) : (
										option.label
									)
								}
							/>
						</Field>
						<Field label={<>Project<Required /></>} hint={selectedPartner ? 'Projects this partner is not on yet.' : 'Choose a partner first.'}>
							<ReactSelect<ProjectProps>
								instanceId="project"
								inputId="project"
								options={projectList}
								isSearchable
								isClearable
								placeholder="Search projects"
								styles={selectStyles<ProjectProps>()}
								onChange={(selectedOption: any) => setSelectedProject(selectedOption)}
								value={selectedProject}
								isDisabled={selectedPartner === null}
								formatOptionLabel={(option, { context }) =>
									context === 'menu' ? (
										<div>
											<div className="tw-font-medium">{option.label}</div>
											<div className="tw-text-xs tw-text-slate-500">
												{option.duration} {option.tenure}
												{option.location ? ` · ${option.location}` : ''}
											</div>
										</div>
									) : (
										option.label
									)
								}
							/>
						</Field>
						<Field label={<>Unit capacity<Required /></>} hint="How many units this partner can hold on the project.">
							{/* Blank instead of "0" (or NaN once cleared): typing into "0" gave 50 for 5. */}
							<Input type='number' min={0} placeholder="e.g. 10" value={partnerUnitCapacity ? partnerUnitCapacity : ''} onChange={(e) => setPartnerUnitCapacity(parseInt(e.target.value))} />
						</Field>
						<Button variant="primary" type="submit" className="tw-w-full">
							<Network className="tw-h-4 tw-w-4" aria-hidden /> Assign partner
						</Button>
					</form>
				</Card>

				<TableCard
					toolbar={
						selectedPartner ? (
							<div className="tw-flex tw-items-center tw-gap-3">
								<Avatar name={selectedPartner.fullName || '?'} seed={selectedPartner.idUsers} size="sm" />
								<div className="tw-min-w-0">
									<p className="tw-text-sm tw-font-semibold tw-text-slate-900">{selectedPartner.fullName}&apos;s projects</p>
									<p className="tw-text-xs tw-text-slate-500">{[selectedPartner.phoneNumber, selectedPartner.location].filter(Boolean).join(' · ') || '—'}</p>
								</div>
							</div>
						) : (
							<p className="tw-text-sm tw-font-semibold tw-text-slate-900">Current projects</p>
						)
					}
				>
					<thead>
						<tr>
							<th className={TH}>Project</th>
							<th className={cx(TH, 'tw-text-right')}>Capacity</th>
							<th className={cx(TH, 'tw-text-right')}>Invested</th>
							<th className={cx(TH, 'tw-text-right')}>Remaining</th>
							<th className={TH}>Bookings</th>
							<th className={cx(TH, 'tw-text-right')}>
								<span className="tw-sr-only">Actions</span>
							</th>
						</tr>
					</thead>
					<tbody>
						{!selectedPartner ? (
							<EmptyRow colSpan={6} title="Choose a partner" hint="Their projects, capacity and bookings will show here." />
						) : partnerships.length === 0 ? (
							<EmptyRow colSpan={6} title="Not on any project yet" />
						) : (
							partnerships.map((project) => {
								const bookings = (project.ProjectPartnerInvestors ?? [])
									.map((investor) => investor?.ProjectInvestor?.ProjectInvestmentBooking)
									.filter((booking) => booking?.bookingId);
								return (
									<tr key={project.idProjectPartners} className={TR}>
										<td className={TD}>
											<Link href={`/projects/details/${project.Project?.idProjects}`} className="tw-font-medium tw-text-slate-900 hover:tw-text-brand-700">
												{project.Project?.projectName}
											</Link>
											<div className="tw-text-xs tw-text-slate-500">
												#{project.Project?.idProjects}
												{project.Project?.location ? ` · ${project.Project.location}` : ''}
											</div>
										</td>
										<td className={cx(TD, 'tw-text-right tw-tabular-nums')}>{project.partnerUnitCapacity}</td>
										<td className={cx(TD, 'tw-text-right tw-tabular-nums')}>{project.alreadyInvested}</td>
										<td className={cx(TD, 'tw-text-right tw-tabular-nums')}>{project.partnerUnitCapacity - project?.alreadyInvested}</td>
										<td className={TD}>
											<div className="tw-flex tw-flex-wrap tw-gap-1">
												{bookings.length === 0 ? (
													<span className="tw-text-xs tw-text-slate-400">None</span>
												) : (
													bookings.map((booking) => (
														<Link
															key={booking!.idProjectInvestmentBookings}
															href={`/bookings/details/${booking!.idProjectInvestmentBookings}`}
															target="_blank"
															rel="noopener noreferrer"
															className="tw-inline-flex tw-items-center tw-gap-0.5 tw-rounded-md tw-bg-slate-100 tw-px-1.5 tw-py-0.5 tw-text-xs tw-font-medium tw-tabular-nums tw-text-slate-700 hover:tw-bg-brand-50 hover:tw-text-brand-700"
														>
															{booking!.bookingId}
															<ArrowUpRight className="tw-h-3 tw-w-3" aria-hidden />
														</Link>
													))
												)}
											</div>
										</td>
										<td className={cx(TD, 'tw-text-right')}>
											{/* Only when nothing is allocated through this partnership: the
											    database refuses to delete one that has allocations (past or
											    pending), so the button could only ever fail there. */}
											{Number(project.alreadyInvested) === 0 && (project.ProjectPartnerInvestors ?? []).length === 0 && (
												<Button size="sm" variant="danger-outline" onClick={() => handleDelete(project.idProjectPartners)}>
													<Trash2 className="tw-h-3.5 tw-w-3.5" aria-hidden /> Remove
												</Button>
											)}
										</td>
									</tr>
								);
							})
						)}
					</tbody>
				</TableCard>
			</div>
		</div>
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
