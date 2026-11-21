import React, { useState, useEffect } from "react";
import Link from "next/link";
import MainLayout from "@/layouts/MainLayout";
import { getRequestOptions } from "@/utils/Fetch";
import Swal from "sweetalert2";
import { S3_URL } from '@/config/public';
import { ChevronRight, Pencil, UserPlus } from "lucide-react";
import { Avatar, Pill, SafeImg, cx } from "@/ui/primitives";
import { Field, Input, LinkButton, Select } from "@/ui/controls";
import { EmptyRow, PageHeader, TableCard, TD, TH, TR } from "@/ui/layout";
import { ListFooter, ListToolbar, SortTH, filterChips, useListState } from "@/ui/table";
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

const DEFAULTS = {
	q: '',
	partnerType: '',
	gender: '',
	disability: '',
	age: '',
	location: '',
	role: '',
	joiningDate: '',
	skills: '',
	orderBy: 'idUsers',
	orderType: 'DESC' as 'ASC' | 'DESC',
	page: 1,
	pageSize: 25,
};

const TYPE_TONE: Record<string, 'green' | 'sky' | 'violet' | 'slate'> = { project: 'green', product: 'sky', both: 'violet', none: 'slate' };

/**
 * Partners: one search box (name, phone, location, role, skills or partner
 * number), filters with chips, sortable columns, rows per page; the view is
 * kept in the URL.
 */
function List() {
	const list = useListState(DEFAULTS);
	const { state, update } = list;
	const [partnersList, setPartnersList] = useState<ListProps[]>([]);
	const [total, setTotal] = useState<number>(0);
	const [loading, setLoading] = useState<boolean>(true);

	useEffect(() => {
		if (!list.ready) return;
		let live = true;
		const fetchPartnersList = async () => {
			setLoading(true);
			try {
				const res = await fetch(`/api/partners/list?${list.query}`, getRequestOptions());
				const data = await res.json();
				if (!live) return;
				if (res.status === 200) {
					setPartnersList(data.data);
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
		fetchPartnersList();
		return () => {
			live = false;
		};
	}, [list.query, list.ready]);

	const text = (key: keyof typeof DEFAULTS) => ({
		value: state[key] as string,
		onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => update({ [key]: e.target.value } as Partial<typeof DEFAULTS>, { typing: e.target.tagName === 'INPUT' }),
	});
	const chips = filterChips(state, list.defaults, {
		partnerType: (v) => `Type: ${words(v)}`,
		gender: 'Gender',
		disability: (v) => (v === 'yes' ? 'With a disability' : 'No disability'),
		age: 'Age',
		location: 'Location',
		role: 'Role',
		joiningDate: 'Joined',
		skills: 'Skill',
	}, update);
	const anyFilter = chips.length > 0 || state.q !== '';

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
					<ListToolbar
						search={state.q}
						onSearch={(q) => update({ q }, { typing: true })}
						placeholder="Name, phone, location, role, skill or #"
						chips={chips}
						onReset={() => list.reset()}
						filters={
							<>
								<Field label="Type">
									<Select {...text('partnerType')}>
										<option value="">All</option>
										<option value="project">Project</option>
										<option value="product">Product</option>
										<option value="both">Both</option>
										<option value="none">None</option>
									</Select>
								</Field>
								<Field label="Gender">
									<Select {...text('gender')}>
										<option value="">All</option>
										<option value="Female">Female</option>
										<option value="Male">Male</option>
										<option value="Other">Other</option>
									</Select>
								</Field>
								<Field label="Disability">
									<Select {...text('disability')}>
										<option value="">All</option>
										<option value="yes">Yes</option>
										<option value="no">No</option>
									</Select>
								</Field>
								<Field label="Age">
									<Input placeholder="e.g. 35" {...text('age')} />
								</Field>
								<Field label="Location">
									<Input placeholder="Any part" {...text('location')} />
								</Field>
								<Field label="Role">
									<Input placeholder="e.g. farmer" {...text('role')} />
								</Field>
								<Field label="Joined">
									<Input placeholder="e.g. 2025-07" {...text('joiningDate')} />
								</Field>
								<Field label="Skill">
									<Input placeholder="e.g. cattle" {...text('skills')} />
								</Field>
							</>
						}
					/>
				}
				footer={<ListFooter page={state.page} pageSize={state.pageSize} total={total} loading={loading} noun="partners" onPage={(page) => update({ page })} onPageSize={(pageSize) => update({ pageSize })} />}
			>
				<thead>
					<tr>
						<SortTH label="Partner" field="fullName" sort={state} onSort={list.sortBy} className="tw-min-w-[15rem]" />
						<th className={TH}>Phone</th>
						<SortTH label="Location" field="location" sort={state} onSort={list.sortBy} />
						<SortTH label="Type" field="partnerType" sort={state} onSort={list.sortBy} />
						<th className={cx(TH, 'tw-min-w-[12rem]')}>Household</th>
						<th className={cx(TH, 'tw-min-w-[13rem]')}>Projects</th>
						<SortTH label="Joined" field="joiningDate" sort={state} onSort={list.sortBy} />
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
						<EmptyRow colSpan={8} title={loading ? 'Loading partners…' : 'No partners match'} hint={!loading && anyFilter ? 'Try other words or fewer filters.' : undefined} />
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
