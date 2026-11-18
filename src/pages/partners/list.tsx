import React, { useState, useEffect } from "react";
import Link from "next/link";
import MainLayout from "@/layouts/MainLayout";
import { getRequestOptions } from "@/utils/Fetch";
import Swal from "sweetalert2";
import { S3_URL } from '@/config/public';
import { ChevronRight, Pencil, SlidersHorizontal, UserPlus, X } from "lucide-react";
import { Avatar, Pill, SafeImg, cx } from "@/ui/primitives";
import { Button, Field, Input, LinkButton, SearchInput, Select } from "@/ui/controls";
import { EmptyRow, PageHeader, Pager, TableCard, TD, TH, TR } from "@/ui/layout";
import { date } from "@/ui/format";
import { words } from "@/ui/status";

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

const INITIAL_FILTER: FilterProps = {
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

};

const MORE_FILTERS: (keyof FilterProps)[] = ['idUsers', 'age', 'location', 'role', 'joiningDate', 'skills', 'disability'];

const TYPE_TONE: Record<string, 'green' | 'sky' | 'violet' | 'slate'> = { project: 'green', product: 'sky', both: 'violet', none: 'slate' };

function List() {
	const [partnersList, setPartnersList] = useState<ListProps[]>([]);
	const [filter, setFilter] = useState<FilterProps>(INITIAL_FILTER);
	const [total, setTotal] = useState<number>(0);
	const [totalPages, setTotalPages] = useState<number>(1);
	const [loading, setLoading] = useState<boolean>(true);
	const [showMore, setShowMore] = useState<boolean>(false);

	useEffect(() => {
		const fetchPartnersList = async () => {
			const query = new URLSearchParams(filter as any).toString();
			setLoading(true);
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
			} finally {
				setLoading(false);
			}
		}
		fetchPartnersList();
	}, [filter]);

	// A changed filter starts again from page 1.
	const handleInputOnChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
		const { name, value } = e.target;
		setFilter({
			...filter,
			[name]: value,
			page: 1
		});
	}

	const pages = Math.max(1, totalPages || 1);
	const handlePageChange = (page: number) => {
		setFilter({
			...filter,
			page: Math.min(Math.max(1, page), pages)
		})
	}

	const moreActive = MORE_FILTERS.filter((key) => filter[key] !== '').length;
	const anyFilter = moreActive > 0 || Boolean(filter.fullName || filter.phoneNumber || filter.partnerType || filter.gender);

	return (
		<div className="ui">
			<PageHeader
				eyebrow="People"
				title="Partners"
				description="The people Shathi works with on projects and products. Open one for their profile, household and projects."
				actions={
					<LinkButton href="/partners/registration" variant="primary">
						<UserPlus className="tw-h-4 tw-w-4" aria-hidden /> Register partner
					</LinkButton>
				}
			/>

			<TableCard
				toolbar={
					<div className="tw-flex tw-flex-col tw-gap-3">
						<div className="tw-grid tw-grid-cols-2 tw-gap-3 lg:tw-grid-cols-[1.6fr_1.4fr_1fr_1fr_auto]">
							<Field label="Name" className="tw-col-span-2 lg:tw-col-span-1">
								<SearchInput placeholder="Search by name" name="fullName" onChange={handleInputOnChange} value={filter.fullName} />
							</Field>
							<Field label="Phone" className="tw-col-span-2 lg:tw-col-span-1">
								<SearchInput placeholder="Any part of the number" name="phoneNumber" onChange={handleInputOnChange} value={filter.phoneNumber} />
							</Field>
							<Field label="Type">
								<Select name="partnerType" onChange={handleInputOnChange} value={filter.partnerType}>
									<option value="">All</option>
									<option value="project">Project</option>
									<option value="product">Product</option>
									<option value="both">Both</option>
									<option value="none">None</option>
								</Select>
							</Field>
							<Field label="Gender">
								<Select name="gender" onChange={handleInputOnChange} value={filter.gender}>
									<option value="">All</option>
									<option value="Female">Female</option>
									<option value="Male">Male</option>
									<option value="Other">Other</option>
								</Select>
							</Field>
							<div className="tw-col-span-2 tw-flex tw-items-end tw-gap-2 lg:tw-col-span-1">
								<Button onClick={() => setShowMore(!showMore)} aria-expanded={showMore}>
									<SlidersHorizontal className="tw-h-4 tw-w-4" aria-hidden />
									More filters
									{moreActive > 0 && <span className="tw-rounded-full tw-bg-brand-700 tw-px-1.5 tw-text-[11px] tw-text-white">{moreActive}</span>}
								</Button>
								{anyFilter && (
									<Button variant="ghost" onClick={() => setFilter({ ...INITIAL_FILTER, pageSize: filter.pageSize })}>
										<X className="tw-h-4 tw-w-4" aria-hidden /> Clear
									</Button>
								)}
							</div>
						</div>
						{showMore && (
							<div className="tw-grid tw-grid-cols-2 tw-gap-3 tw-rounded-xl tw-bg-slate-50 tw-p-3 md:tw-grid-cols-4 xl:tw-grid-cols-7">
								<Field label="Partner #">
									<Input type="number" placeholder="e.g. 140" name="idUsers" onChange={handleInputOnChange} value={filter.idUsers} />
								</Field>
								<Field label="Age">
									<Input placeholder="e.g. 35" name="age" onChange={handleInputOnChange} value={filter.age} />
								</Field>
								<Field label="Location">
									<Input placeholder="Any part" name="location" onChange={handleInputOnChange} value={filter.location} />
								</Field>
								<Field label="Role">
									<Input placeholder="e.g. farmer" name="role" onChange={handleInputOnChange} value={filter.role} />
								</Field>
								<Field label="Joined">
									<Input placeholder="e.g. 2025-07" name="joiningDate" onChange={handleInputOnChange} value={filter.joiningDate} />
								</Field>
								<Field label="Skill">
									<Input placeholder="e.g. cattle" name="skills" onChange={handleInputOnChange} value={filter.skills} />
								</Field>
								<Field label="Disability">
									<Select name="disability" onChange={handleInputOnChange} value={filter.disability}>
										<option value="">All</option>
										<option value="yes">Yes</option>
										<option value="no">No</option>
									</Select>
								</Field>
							</div>
						)}
						<p className="tw-text-xs tw-tabular-nums tw-text-slate-500">{loading ? 'Loading…' : `${Number(total || 0).toLocaleString('en-IN')} partners`}</p>
					</div>
				}
				footer={<Pager page={filter.page} totalPages={pages} onChange={handlePageChange} summary={total ? `Page ${filter.page} of ${pages}` : undefined} />}
			>
				<thead>
					<tr>
						<th className={cx(TH, 'tw-min-w-[15rem]')}>Partner</th>
						<th className={TH}>Phone</th>
						<th className={TH}>Location</th>
						<th className={TH}>Type</th>
						<th className={cx(TH, 'tw-min-w-[12rem]')}>Household</th>
						<th className={cx(TH, 'tw-min-w-[13rem]')}>Projects</th>
						<th className={TH}>Joined</th>
						<th className={cx(TH, 'tw-text-right')}>
							<span className="tw-sr-only">Actions</span>
						</th>
					</tr>
				</thead>
				<tbody className={cx(loading && 'tw-opacity-60 tw-transition-opacity')}>
					{partnersList.length > 0 ? partnersList.map((partner) => {
						const info = partner.PartnerAdditionalInfo;
						const household = [
							info?.gender,
							info?.household_size ? `${info.household_size} in household` : null,
							info?.dependents_size ? `${info.dependents_size} dependents` : null,
						].filter(Boolean).join(' · ');
						return (
							<tr key={partner.idUsers} className={TR}>
								<td className={TD}>
									<div className="tw-flex tw-items-center tw-gap-3">
										<SafeImg
											src={partner.ProfilePicture ? `${S3_URL}profile-picture/${partner.idUsers}/${partner.ProfilePicture.fileName}` : null}
											className="tw-h-10 tw-w-10 tw-shrink-0 tw-rounded-full tw-object-cover tw-ring-1 tw-ring-slate-200"
											fallback={<Avatar name={partner.fullName || '?'} seed={Number(partner.idUsers)} />}
										/>
										<div className="tw-min-w-0">
											<Link href={`/partners/details/${partner.idUsers}`} className="tw-font-medium tw-text-slate-900 hover:tw-text-brand-700">
												{partner.fullName}
											</Link>
											<div className="tw-text-xs tw-text-slate-500">
												#{partner.idUsers}
												{partner.role ? ` · ${partner.role}` : ''}
												{partner.age ? ` · ${partner.age} yrs` : ''}
											</div>
										</div>
									</div>
								</td>
								<td className={cx(TD, 'tw-whitespace-nowrap tw-tabular-nums tw-text-slate-700')}>{partner.phoneNumber || <span className="tw-text-slate-300">—</span>}</td>
								<td className={cx(TD, 'tw-max-w-[14rem] tw-text-slate-600')}>
									{partner.location ? (
										<span className="tw-line-clamp-2" title={partner.location}>{partner.location}</span>
									) : (
										<span className="tw-text-slate-300">—</span>
									)}
								</td>
								<td className={TD}>
									<div className="tw-flex tw-flex-wrap tw-gap-1">
										<Pill tone={TYPE_TONE[partner.partnerType] ?? 'slate'} dot={false}>{words(partner.partnerType)}</Pill>
										{partner.disability === 'yes' && <Pill tone="amber" dot={false}>Disability</Pill>}
									</div>
								</td>
								<td className={TD}>
									<div className="tw-text-sm tw-text-slate-700">{household || <span className="tw-text-slate-300">—</span>}</div>
									{info?.livelihood_activity && <div className="tw-text-xs tw-text-slate-500">{info.livelihood_activity}</div>}
								</td>
								<td className={TD}>
									{partner.Partnerships.length === 0 ? (
										<span className="tw-text-xs tw-text-slate-400">None</span>
									) : (
										<ul className="tw-space-y-0.5">
											{partner.Partnerships.map((project, index) => (
												<li key={index} className="tw-flex tw-items-baseline tw-justify-between tw-gap-3 tw-text-xs">
													<span className="tw-truncate tw-text-slate-700">{project.Project?.projectName}</span>
													<span className="tw-shrink-0 tw-tabular-nums tw-text-slate-500" title="Confirmed units / capacity">
														{project.alreadyInvestedUnits}/{Number(project.partnerUnitCapacity) > 0 ? project.partnerUnitCapacity : '∞'}
													</span>
												</li>
											))}
										</ul>
									)}
								</td>
								<td className={cx(TD, 'tw-whitespace-nowrap tw-tabular-nums tw-text-slate-600')}>{partner.joiningDate ? date(String(partner.joiningDate)) : '—'}</td>
								<td className={cx(TD, 'tw-whitespace-nowrap tw-text-right')}>
									<div className="tw-inline-flex tw-items-center tw-gap-1">
										<LinkButton href={`/partners/edit/${partner.idUsers}`} variant="ghost" size="sm">
											<Pencil className="tw-h-3.5 tw-w-3.5" aria-hidden /> Edit
										</LinkButton>
										<Link
											href={`/partners/details/${partner.idUsers}`}
											className="tw-inline-flex tw-h-8 tw-w-8 tw-items-center tw-justify-center tw-rounded-lg tw-text-slate-400 hover:tw-bg-slate-100 hover:tw-text-slate-700"
											aria-label={`Open ${partner.fullName}`}
										>
											<ChevronRight className="tw-h-4 tw-w-4" aria-hidden />
										</Link>
									</div>
								</td>
							</tr>
						);
					}) : (
						<EmptyRow colSpan={8} title={loading ? 'Loading partners…' : 'No partners match'} hint={!loading && anyFilter ? 'Try fewer filters.' : undefined} />
					)}
				</tbody>
			</TableCard>
		</div>
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
