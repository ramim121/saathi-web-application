import React, { useState, useEffect } from "react";
import Link from "next/link";
import MainLayout from "@/layouts/MainLayout";
import { getRequestOptions } from "@/utils/Fetch";
import Swal from "sweetalert2";
import { S3_URL } from '@/config/public';
import { ChevronRight, FolderKanban, Pencil, Plus, SlidersHorizontal, X } from "lucide-react";
import { Pill, SafeImg, cx } from "@/ui/primitives";
import { Button, Field, Input, LinkButton, SearchInput, Select } from "@/ui/controls";
import { EmptyRow, PageHeader, Pager, TableCard, TD, TH, TR } from "@/ui/layout";
import { bdtExact } from "@/ui/format";
import { PROJECT_STATUSES, projectStatus, returnRange, words } from "@/ui/status";

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

const INITIAL_FILTER: FilterProps = {
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

};

/** Filters that live behind "More filters": rarely used, and they crowded the header row. */
const MORE_FILTERS: (keyof FilterProps)[] = ['idProjects', 'unitInvestmentValue', 'returnRangeMin', 'duration', 'totalAvailableUnits', 'investorUnitCapacity'];

/** The project's main image, or a placeholder when there is none or it fails to load. */
function Thumb({ project }: { project: ListProps }) {
	return (
		<SafeImg
			src={project.MainImage ? `${S3_URL}project-main-image/${project.idProjects}/${project.MainImage.fileName}` : null}
			className="tw-h-11 tw-w-11 tw-shrink-0 tw-rounded-xl tw-bg-slate-100 tw-object-cover tw-ring-1 tw-ring-slate-200"
			fallback={
				<span className="tw-flex tw-h-11 tw-w-11 tw-shrink-0 tw-items-center tw-justify-center tw-rounded-xl tw-bg-slate-100 tw-text-slate-400">
					<FolderKanban className="tw-h-5 tw-w-5" aria-hidden />
				</span>
			}
		/>
	);
}

function UnitsCell({ project }: { project: ListProps }) {
	const invested = Number(project.alreadyInvested || 0);
	const available = Number(project.totalAvailableUnits || 0);
	/* A project with no unit total (0) has no cap; the API then reports 0
	   remaining, which would read as "full". */
	if (!available) {
		return (
			<div className="tw-text-sm">
				<span className="tw-font-medium tw-tabular-nums tw-text-slate-900">{invested}</span>
				<span className="tw-text-slate-500"> invested</span>
				<div className="tw-text-xs tw-text-slate-400">No unit cap</div>
			</div>
		);
	}
	const share = Math.min(100, Math.round((invested / available) * 100));
	return (
		<div className="tw-min-w-[9rem]">
			<div className="tw-flex tw-items-baseline tw-justify-between tw-gap-2 tw-text-sm">
				<span className="tw-tabular-nums">
					<span className="tw-font-medium tw-text-slate-900">{invested}</span>
					<span className="tw-text-slate-500"> / {available}</span>
				</span>
				<span className="tw-text-xs tw-tabular-nums tw-text-slate-500">{Number(project.totalRemainingUnits || 0)} left</span>
			</div>
			<div className="tw-mt-1.5 tw-h-1.5 tw-overflow-hidden tw-rounded-full tw-bg-slate-100" role="presentation">
				<div className={cx('tw-h-full tw-rounded-full', share >= 100 ? 'tw-bg-amber-500' : 'tw-bg-brand-500')} style={{ width: `${share}%` }} />
			</div>
		</div>
	);
}

function List() {
	const [projectsList, setProjectsList] = useState<ListProps[]>([]);
	const [filter, setFilter] = useState<FilterProps>(INITIAL_FILTER);
	const [total, setTotal] = useState<number>(0);
	const [totalPages, setTotalPages] = useState<number>(1);
	const [loading, setLoading] = useState<boolean>(true);
	const [showMore, setShowMore] = useState<boolean>(false);

	useEffect(() => {
		const fetchProjectsList = async () => {
			const query = new URLSearchParams(filter as any).toString();
			setLoading(true);
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
			} finally {
				setLoading(false);
			}
		}
		fetchProjectsList();
	}, [filter]);

	// A changed filter starts again from page 1: page 5 of a narrower result may not exist.
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
	const anyFilter = moreActive > 0 || Boolean(filter.projectName || filter.categoryName || filter.investmentType || filter.projectStatus);

	return (
		<div className="ui">
			<PageHeader
				eyebrow="Projects"
				title="All projects"
				description="Pricing, returns and how many units each project has taken. Open one for its investors, partners and images."
				actions={
					<LinkButton href="/projects/create" variant="primary">
						<Plus className="tw-h-4 tw-w-4" aria-hidden /> New project
					</LinkButton>
				}
			/>

			<TableCard
				toolbar={
					<div className="tw-flex tw-flex-col tw-gap-3">
						<div className="tw-grid tw-grid-cols-2 tw-gap-3 lg:tw-grid-cols-[2fr_1.3fr_1.3fr_1.3fr_auto]">
							<Field label="Project" className="tw-col-span-2 lg:tw-col-span-1">
								<SearchInput placeholder="Search by name" name="projectName" onChange={handleInputOnChange} value={filter.projectName} />
							</Field>
							<Field label="Category">
								<Input placeholder="Any" name="categoryName" onChange={handleInputOnChange} value={filter.categoryName} />
							</Field>
							<Field label="Type">
								<Select name="investmentType" onChange={handleInputOnChange} value={filter.investmentType}>
									<option value="">All</option>
									<option value="sustainable_return">Sustainable return</option>
									<option value="fast_return">Fast return</option>
								</Select>
							</Field>
							<Field label="Status">
								<Select name="projectStatus" onChange={handleInputOnChange} value={filter.projectStatus}>
									<option value="">All</option>
									{PROJECT_STATUSES.map((s) => (
										<option key={s.value} value={s.value}>
											{s.label}
										</option>
									))}
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
							<div className="tw-grid tw-grid-cols-2 tw-gap-3 tw-rounded-xl tw-bg-slate-50 tw-p-3 md:tw-grid-cols-3 xl:tw-grid-cols-6">
								<Field label="Project #">
									<Input type="number" placeholder="e.g. 20" name="idProjects" onChange={handleInputOnChange} value={filter.idProjects} />
								</Field>
								<Field label="Unit price">
									<Input placeholder="e.g. 25000" name="unitInvestmentValue" onChange={handleInputOnChange} value={filter.unitInvestmentValue} />
								</Field>
								<Field label="Return from (%)">
									<Input placeholder="e.g. 13" name="returnRangeMin" onChange={handleInputOnChange} value={filter.returnRangeMin} />
								</Field>
								<Field label="Duration">
									<Input placeholder="e.g. 4" name="duration" onChange={handleInputOnChange} value={filter.duration} />
								</Field>
								<Field label="Total units">
									<Input placeholder="e.g. 100" name="totalAvailableUnits" onChange={handleInputOnChange} value={filter.totalAvailableUnits} />
								</Field>
								<Field label="Investor cap">
									<Input placeholder="e.g. 10" name="investorUnitCapacity" onChange={handleInputOnChange} value={filter.investorUnitCapacity} />
								</Field>
							</div>
						)}
						<p className="tw-text-xs tw-tabular-nums tw-text-slate-500">{loading ? 'Loading…' : `${Number(total || 0).toLocaleString('en-IN')} projects`}</p>
					</div>
				}
				footer={<Pager page={filter.page} totalPages={pages} onChange={handlePageChange} summary={total ? `Page ${filter.page} of ${pages}` : undefined} />}
			>
				<thead>
					<tr>
						<th className={cx(TH, 'tw-min-w-[17rem]')}>Project</th>
						<th className={cx(TH, 'tw-text-right')}>Unit price</th>
						<th className={TH}>Return &amp; term</th>
						<th className={TH}>Units</th>
						<th className={cx(TH, 'tw-text-right')}>Per investor</th>
						<th className={TH}>Status</th>
						<th className={cx(TH, 'tw-text-right')}>
							<span className="tw-sr-only">Actions</span>
						</th>
					</tr>
				</thead>
				<tbody className={cx(loading && 'tw-opacity-60 tw-transition-opacity')}>
					{projectsList.length > 0 ? projectsList.map((project) => {
						const status = projectStatus(project.projectStatus);
						return (
							<tr key={project.idProjects} className={TR}>
								<td className={TD}>
									<div className="tw-flex tw-items-center tw-gap-3">
										<Thumb project={project} />
										<div className="tw-min-w-0">
											<Link href={`/projects/details/${project.idProjects}`} className="tw-font-medium tw-text-slate-900 hover:tw-text-brand-700">
												{project.projectName}
											</Link>
											<div className="tw-text-xs tw-text-slate-500">
												#{project.idProjects}
												{project.ProjectCategory?.categoryName && <> · {project.ProjectCategory.categoryName}</>}
											</div>
										</div>
									</div>
								</td>
								<td className={cx(TD, 'tw-whitespace-nowrap tw-text-right tw-font-medium tw-tabular-nums tw-text-slate-900')}>{bdtExact(Number(project.unitInvestmentValue))}</td>
								<td className={cx(TD, 'tw-whitespace-nowrap')}>
									<div className="tw-font-medium tw-tabular-nums tw-text-slate-900">{returnRange(project.returnRangeMin, project.returnRangeMax)}</div>
									<div className="tw-text-xs tw-text-slate-500">
										{project.duration} {project.tenure} · {words(project.investmentType)}
									</div>
								</td>
								<td className={TD}><UnitsCell project={project} /></td>
								<td className={cx(TD, 'tw-whitespace-nowrap tw-text-right tw-tabular-nums tw-text-slate-600')}>
									{Number(project.investorUnitCapacity) > 0 ? project.investorUnitCapacity : <span className="tw-text-slate-400">No limit</span>}
								</td>
								<td className={TD}><Pill tone={status.tone}>{status.label}</Pill></td>
								<td className={cx(TD, 'tw-whitespace-nowrap tw-text-right')}>
									<div className="tw-inline-flex tw-items-center tw-gap-1">
										<LinkButton href={`/projects/edit/${project.idProjects}`} variant="ghost" size="sm">
											<Pencil className="tw-h-3.5 tw-w-3.5" aria-hidden /> Edit
										</LinkButton>
										<Link
											href={`/projects/details/${project.idProjects}`}
											className="tw-inline-flex tw-h-8 tw-w-8 tw-items-center tw-justify-center tw-rounded-lg tw-text-slate-400 hover:tw-bg-slate-100 hover:tw-text-slate-700"
											aria-label={`Open ${project.projectName}`}
										>
											<ChevronRight className="tw-h-4 tw-w-4" aria-hidden />
										</Link>
									</div>
								</td>
							</tr>
						);
					}) : (
						<EmptyRow colSpan={7} title={loading ? 'Loading projects…' : 'No projects match'} hint={!loading && anyFilter ? 'Try fewer filters.' : undefined} />
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
