import React, { useState, useEffect } from "react";
import Link from "next/link";
import MainLayout from "@/layouts/MainLayout";
import { getRequestOptions } from "@/utils/Fetch";
import Swal from "sweetalert2";
import { S3_URL } from '@/config/public';
import { ChevronRight, FolderKanban, Pencil, Plus } from "lucide-react";
import { Pill, SafeImg, cx } from "@/ui/primitives";
import { Field, Input, LinkButton, Select } from "@/ui/controls";
import { CapacityBar, CapacityPill } from "@/components/projects/CapacityBar";
import { CAPACITY_FILTERS, needsAttention, type ProjectCapacity } from "@/utils/partnerCapacityShared";
import { EmptyRow, PageHeader, TableCard, TD, TH, TR } from "@/ui/layout";
import { ListFooter, ListToolbar, SortTH, filterChips, useListState } from "@/ui/table";
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
	capacity?: ProjectCapacity | null,
	MainImage: {
		fileName: string,
		originalFileName: string
	}
}

const DEFAULTS = {
	q: '',
	categoryName: '',
	investmentType: '',
	projectStatus: '',
	unitInvestmentValue: '',
	returnRangeMin: '',
	duration: '',
	totalAvailableUnits: '',
	investorUnitCapacity: '',
	capacity: '',
	orderBy: 'idProjects',
	orderType: 'DESC' as 'ASC' | 'DESC',
	page: 1,
	pageSize: 25,
};

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

/**
 * Units against the real ceiling: the smaller of the project's total and what
 * its partners can hold. Reserved (unpaid) units count, shown lighter.
 */
function UnitsCell({ project }: { project: ListProps }) {
	const c = project.capacity;
	if (!c) return <span className="tw-text-slate-300">—</span>;
	const open = c.level !== 'closed';
	return (
		<div className="tw-min-w-[12rem]">
			<div className="tw-flex tw-items-baseline tw-justify-between tw-gap-2 tw-text-sm">
				<span className="tw-tabular-nums" title={`${c.confirmed} paid, ${c.pending} awaiting payment`}>
					<span className="tw-font-medium tw-text-slate-900">{c.confirmed + c.pending}</span>
					<span className="tw-text-slate-500"> / {c.limit ?? 'no limit'}</span>
				</span>
				<span className="tw-text-xs tw-tabular-nums tw-text-slate-500">{c.left === null ? '' : `${c.left} left`}</span>
			</div>
			<CapacityBar className="tw-mt-1.5" confirmed={c.confirmed} pending={c.pending} limit={c.limit} level={c.level} />
			{open && (needsAttention(c) || c.gap > 0) && (
				<Link href={`/projects/partner_assign?project=${c.idProjects}`} className="tw-mt-1.5 tw-flex tw-flex-wrap tw-items-center tw-gap-1.5 tw-text-xs tw-font-medium tw-text-amber-700 hover:tw-underline">
					{needsAttention(c) && <CapacityPill level={c.level} />}
					{c.gap > 0 && <span>Offers {c.totalUnits}, partners hold {c.partnerCapacity}</span>}
				</Link>
			)}
		</div>
	);
}

function List() {
	const list = useListState(DEFAULTS);
	const { state, update } = list;
	const [projectsList, setProjectsList] = useState<ListProps[]>([]);
	const [total, setTotal] = useState<number>(0);
	const [loading, setLoading] = useState<boolean>(true);

	useEffect(() => {
		if (!list.ready) return;
		let live = true;
		const fetchProjectsList = async () => {
			setLoading(true);
			try {
				const res = await fetch(`/api/projects/list?${list.query}`, getRequestOptions());
				const data = await res.json();
				if (!live) return;
				if (res.status === 200) {
					setProjectsList(data.data);
					setTotal(Number(data.total) || 0);
				} else {
					Swal.fire({ icon: 'error', title: 'Error', text: data.message });
				}
			} catch (err: any) {
				if (live) Swal.fire({ icon: 'error', title: 'Error', text: err.message });
			} finally {
				if (live) setLoading(false);
			}
		}
		fetchProjectsList();
		return () => {
			live = false;
		};
	}, [list.query, list.ready]);

	const field = (key: keyof typeof DEFAULTS) => ({
		value: state[key] as string,
		onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => update({ [key]: e.target.value } as Partial<typeof DEFAULTS>, { typing: e.target.tagName === 'INPUT' }),
	});
	const chips = filterChips(state, list.defaults, {
		categoryName: 'Category',
		investmentType: (v) => `Type: ${words(v)}`,
		projectStatus: (v) => `Status: ${projectStatus(v).label}`,
		unitInvestmentValue: 'Unit price',
		returnRangeMin: (v) => `Return from ${v}%`,
		duration: 'Duration',
		totalAvailableUnits: 'Total units',
		investorUnitCapacity: 'Investor cap',
		capacity: (v) => `Capacity: ${CAPACITY_FILTERS.find((f) => f.value === v)?.label ?? v}`,
	}, update);
	const anyFilter = chips.length > 0 || state.q !== '';

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
					<ListToolbar
						search={state.q}
						onSearch={(q) => update({ q }, { typing: true })}
						placeholder="Project name, location or #"
						chips={chips}
						onReset={() => list.reset()}
						filters={
							<>
								<Field label="Capacity">
									<Select {...field('capacity')}>
										<option value="">All</option>
										{CAPACITY_FILTERS.map((f) => (
											<option key={f.value} value={f.value}>
												{f.label}
											</option>
										))}
									</Select>
								</Field>
								<Field label="Status">
									<Select {...field('projectStatus')}>
										<option value="">All</option>
										{PROJECT_STATUSES.map((st) => (
											<option key={st.value} value={st.value}>
												{st.label}
											</option>
										))}
									</Select>
								</Field>
								<Field label="Type">
									<Select {...field('investmentType')}>
										<option value="">All</option>
										<option value="sustainable_return">Sustainable return</option>
										<option value="fast_return">Fast return</option>
									</Select>
								</Field>
								<Field label="Category">
									<Input placeholder="Any" {...field('categoryName')} />
								</Field>
								<Field label="Unit price">
									<Input placeholder="e.g. 25000" {...field('unitInvestmentValue')} />
								</Field>
								<Field label="Return from (%)">
									<Input placeholder="e.g. 13" {...field('returnRangeMin')} />
								</Field>
								<Field label="Duration">
									<Input placeholder="e.g. 4" {...field('duration')} />
								</Field>
								<Field label="Total units">
									<Input placeholder="e.g. 100" {...field('totalAvailableUnits')} />
								</Field>
								<Field label="Investor cap">
									<Input placeholder="e.g. 10" {...field('investorUnitCapacity')} />
								</Field>
							</>
						}
					/>
				}
				footer={<ListFooter page={state.page} pageSize={state.pageSize} total={total} loading={loading} noun="projects" onPage={(page) => update({ page })} onPageSize={(pageSize) => update({ pageSize })} />}
			>
				<thead>
					<tr>
						<SortTH label="Project" field="projectName" sort={state} onSort={list.sortBy} className="tw-min-w-[17rem]" />
						<SortTH label="Unit price" field="unitInvestmentValue" sort={state} onSort={list.sortBy} align="right" />
						<SortTH label="Return & term" field="returnRangeMax" sort={state} onSort={list.sortBy} />
						<SortTH label="Units" field="totalAvailableUnits" sort={state} onSort={list.sortBy} />
						<SortTH label="Per investor" field="investorUnitCapacity" sort={state} onSort={list.sortBy} align="right" />
						<SortTH label="Status" field="projectStatus" sort={state} onSort={list.sortBy} />
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
