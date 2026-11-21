import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Swal from 'sweetalert2';
import { AlertTriangle, ArrowUpRight, Copy, Loader2, Network, Trash2, UserPlus } from 'lucide-react';
import MainLayout from '@/layouts/MainLayout';
import { API_URL } from '@/config/public';
import { deleteRequestOptions, getRequestOptions, postRequestOptions, putRequestOptions } from '@/utils/Fetch';
import { Avatar, Card, Segmented, Skeleton, cx } from '@/ui/primitives';
import { Button, Field, Input, LinkButton, SearchInput, Select } from '@/ui/controls';
import { EmptyRow, PageHeader, TableCard, TD, TH, TR } from '@/ui/layout';
import { bdt } from '@/ui/format';
import { CapacityBar, CapacityPill } from '@/components/projects/CapacityBar';
import { UnitsPicker, readPicked, type Picked } from '@/components/projects/UnitsPicker';
import {
    isOpenProject,
    needsAttention,
    nextProjectTotal,
    unitsLeft,
    type PartnerLoad,
    type ProjectCapacity,
} from '@/utils/partnerCapacityShared';

/**
 * Partner assignment: one page for what used to be two forms that added one
 * row at a time. Work from a project (many partners) or from a partner (many
 * projects); either way, capacity is visible and editable in place.
 */

type PartnerRow = { idUsers: number; fullName: string; phoneNumber: string | null; location: string | null };
type Data = { projects: ProjectCapacity[]; partners: PartnerRow[]; assignments: PartnerLoad[] };
type Mode = 'project' | 'partner';

const rank = (p: ProjectCapacity) => (!isOpenProject(p.projectStatus) ? 3 : needsAttention(p) ? 0 : p.gap > 0 ? 1 : 2);

function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: string }) {
    return (
        <div className="tw-min-w-0">
            <dt className="tw-truncate tw-text-xs tw-text-slate-500">{label}</dt>
            <dd className={cx('tw-mt-0.5 tw-text-lg tw-font-semibold tw-tabular-nums', tone ?? 'tw-text-slate-900')}>{value}</dd>
        </div>
    );
}

/** A capacity cell that saves when it changes and the field is left. */
function CapacityInput({ row, onSave }: { row: PartnerLoad; onSave: (row: PartnerLoad, value: number) => Promise<boolean> }) {
    const [value, setValue] = useState(String(row.capacity));
    const [saving, setSaving] = useState(false);
    useEffect(() => setValue(String(row.capacity)), [row.capacity]);
    const save = async () => {
        const next = Number(value);
        if (value === String(row.capacity)) return;
        if (!Number.isInteger(next) || next < 1) {
            setValue(String(row.capacity));
            Swal.fire({ icon: 'error', title: 'Enter whole units, 1 or more' });
            return;
        }
        setSaving(true);
        const ok = await onSave(row, next);
        setSaving(false);
        if (!ok) setValue(String(row.capacity));
    };
    return (
        <span className="tw-relative tw-ml-auto tw-block tw-w-24">
            <Input
                type="number"
                min={Math.max(1, row.confirmed)}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onBlur={save}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                }}
                disabled={saving}
                aria-label={`Capacity for ${row.fullName}`}
                className="tw-text-right"
            />
            {saving && <Loader2 className="tw-absolute tw-left-2 tw-top-1/2 tw-h-3.5 tw-w-3.5 -tw-translate-y-1/2 tw-animate-spin tw-text-slate-400" aria-hidden />}
        </span>
    );
}

function PartnerAssign() {
    const router = useRouter();
    const [data, setData] = useState<Data | null>(null);
    const [mode, setMode] = useState<Mode>('project');
    const [idProject, setIdProject] = useState<number | null>(null);
    const [idPartner, setIdPartner] = useState<number | null>(null);
    const [query, setQuery] = useState('');
    const [picked, setPicked] = useState<Picked>({});
    const [copyFrom, setCopyFrom] = useState('');
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        try {
            const res = await fetch('/api/assignments', getRequestOptions());
            const body = await res.json();
            if (!res.ok) throw new Error(body.message);
            setData(body.data);
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'Could not load assignments', text: (err as Error).message });
        }
    }, []);
    useEffect(() => {
        load();
    }, [load]);

    // Deep links: ?project=49 or ?partner=622 from the other pages.
    useEffect(() => {
        if (!router.isReady) return;
        const project = Number(router.query.project);
        const partner = Number(router.query.partner);
        if (partner > 0) {
            setMode('partner');
            setIdPartner(partner);
        } else if (project > 0) {
            setMode('project');
            setIdProject(project);
        } else if (router.query.mode === 'partner') setMode('partner');
    }, [router.isReady, router.query.project, router.query.partner, router.query.mode]);

    const switchMode = (next: Mode) => {
        setMode(next);
        setQuery('');
        setPicked({});
        setCopyFrom('');
    };
    const chooseProject = (id: number) => {
        setIdProject(id);
        setPicked({});
        setCopyFrom('');
    };
    const choosePartner = (id: number) => {
        setIdPartner(id);
        setPicked({});
    };

    const projects = useMemo(() => [...(data?.projects ?? [])].sort((a, b) => rank(a) - rank(b) || b.usedPercent - a.usedPercent || b.idProjects - a.idProjects), [data]);
    const project = projects.find((p) => p.idProjects === idProject) ?? null;
    const partner = data?.partners.find((p) => p.idUsers === idPartner) ?? null;
    const onProject = useMemo(() => (data?.assignments ?? []).filter((a) => a.idProjects === idProject), [data, idProject]);
    const ofPartner = useMemo(() => (data?.assignments ?? []).filter((a) => a.idUsers === idPartner), [data, idPartner]);
    const countFor = useMemo(() => {
        const map = new Map<number, number>();
        for (const a of data?.assignments ?? []) map.set(a.idUsers, (map.get(a.idUsers) ?? 0) + 1);
        return map;
    }, [data]);

    const q = query.trim().toLowerCase();
    const leftProjects = q ? projects.filter((p) => `${p.projectName} ${p.location ?? ''} ${p.idProjects}`.toLowerCase().includes(q)) : projects;
    const leftPartners = (data?.partners ?? []).filter((p) => !q || `${p.fullName} ${p.phoneNumber ?? ''} ${p.location ?? ''}`.toLowerCase().includes(q));

    const addablePartners = useMemo(() => {
        const on = new Set(onProject.map((a) => a.idUsers));
        return (data?.partners ?? [])
            .filter((p) => !on.has(p.idUsers))
            .map((p) => ({ id: p.idUsers, title: p.fullName, subtitle: [p.phoneNumber, p.location, `${countFor.get(p.idUsers) ?? 0} project(s)`].filter(Boolean).join(' · ') }));
    }, [data, onProject, countFor]);
    const addableProjects = useMemo(() => {
        const on = new Set(ofPartner.map((a) => a.idProjects));
        return projects
            .filter((p) => isOpenProject(p.projectStatus) && !on.has(p.idProjects))
            .map((p) => ({ id: p.idProjects, title: p.projectName, subtitle: [`${p.duration} ${p.tenure}`, bdt(p.unitValue) + ' per unit', p.left === null ? 'no limit' : `${p.left} units left`].join(' · ') }));
    }, [projects, ofPartner]);

    const copySources = projects.filter((p) => p.idProjects !== idProject && p.partners > 0);
    const applyCopy = (value: string) => {
        setCopyFrom(value);
        if (!value) return;
        const addable = new Set(addablePartners.map((p) => p.id));
        const next: Picked = {};
        for (const a of data?.assignments ?? []) {
            if (a.idProjects === Number(value) && addable.has(a.idUsers)) next[a.idUsers] = String(a.capacity || '');
        }
        setPicked(next);
    };

    const preview = readPicked(picked);
    const addedUnits = preview.problem ? 0 : preview.rows.reduce((sum, r) => sum + r.units, 0);
    const previewTotal = (() => {
        if (mode !== 'project' || !project || !addedUnits || project.partnerCapacity === null) return null;
        const to = nextProjectTotal(project.totalUnits, project.partnerCapacity, project.partnerCapacity + addedUnits, project.confirmed);
        return to !== project.totalUnits ? { from: project.totalUnits, to } : null;
    })();

    const submitAdd = async () => {
        const { rows, problem } = readPicked(picked);
        if (!rows.length) return;
        if (problem) {
            Swal.fire({ icon: 'warning', title: problem });
            return;
        }
        const pairs = rows.map((r) => (mode === 'project' ? { idProjects: idProject, idUsers: r.id, capacity: r.units } : { idProjects: r.id, idUsers: idPartner, capacity: r.units }));
        setSaving(true);
        try {
            const res = await fetch(API_URL + 'api/assignments', postRequestOptions({ pairs }));
            const body = await res.json();
            if (!res.ok) throw new Error(body.message);
            const changed = (body.data.totals ?? []) as { projectName: string; from: number; to: number }[];
            Swal.fire({
                icon: 'success',
                title: `${body.data.created} assignment${body.data.created === 1 ? '' : 's'} added`,
                text: changed.length ? changed.map((t) => `${t.projectName}: total units ${t.from} → ${t.to}`).join('. ') : undefined,
                timer: changed.length ? undefined : 1800,
                showConfirmButton: changed.length > 0,
            });
            setPicked({});
            setCopyFrom('');
            await load();
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'Not assigned', html: (err as Error).message });
        } finally {
            setSaving(false);
        }
    };

    const saveCapacity = async (row: PartnerLoad, value: number) => {
        try {
            const res = await fetch(`${API_URL}api/assignments/${row.idProjectPartners}`, putRequestOptions({ capacity: value }));
            const body = await res.json();
            if (!res.ok) throw new Error(body.message);
            if (body.data.warning) Swal.fire({ icon: 'warning', title: 'Capacity saved', text: body.data.warning });
            await load();
            return true;
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'Not saved', text: (err as Error).message });
            return false;
        }
    };

    const remove = async (row: PartnerLoad, label: string) => {
        const answer = await Swal.fire({ title: `Remove ${label}?`, icon: 'warning', showCancelButton: true, confirmButtonText: 'Remove', cancelButtonText: 'Keep' });
        if (!answer.value) return;
        try {
            const res = await fetch(API_URL + 'api/projects/delete-partner-assign/' + row.idProjectPartners, deleteRequestOptions());
            const body = await res.json();
            if (!res.ok) throw new Error(body.message);
            await load();
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'Not removed', text: (err as Error).message });
        }
    };

    const rowCells = (row: PartnerLoad) => {
        const left = unitsLeft(row);
        const full = left === 0;
        return (
            <>
                <td className={cx(TD, 'tw-min-w-[9rem]')}>
                    <div className="tw-flex tw-justify-between tw-text-xs tw-tabular-nums tw-text-slate-500">
                        <span>{row.confirmed} paid{row.pending ? ` · ${row.pending} waiting` : ''}</span>
                    </div>
                    <CapacityBar className="tw-mt-1" confirmed={row.confirmed} pending={row.pending} limit={row.capacity || null} level={full ? 'full' : 'ok'} />
                </td>
                <td className={cx(TD, 'tw-text-right tw-font-semibold tw-tabular-nums', full ? 'tw-text-rose-700' : 'tw-text-slate-900')}>{left === null ? 'No limit' : left}</td>
                <td className={TD}>
                    <CapacityInput row={row} onSave={saveCapacity} />
                </td>
            </>
        );
    };

    const removeCell = (row: PartnerLoad, label: string) => (
        <td className={cx(TD, 'tw-text-right')}>
            {row.confirmed === 0 && row.pending === 0 ? (
                <button type="button" onClick={() => remove(row, label)} className="tw-rounded-lg tw-p-2 tw-text-slate-400 hover:tw-bg-rose-50 hover:tw-text-rose-600" aria-label={`Remove ${label}`}>
                    <Trash2 className="tw-h-4 tw-w-4" aria-hidden />
                </button>
            ) : null}
        </td>
    );

    const listButton = (key: number, active: boolean, onClick: () => void, body: React.ReactNode) => (
        <li key={key}>
            <button type="button" onClick={onClick} aria-current={active ? 'true' : undefined} className={cx('tw-w-full tw-px-3 tw-py-2.5 tw-text-left tw-transition', active ? 'tw-bg-brand-50' : 'hover:tw-bg-slate-50')}>
                {body}
            </button>
        </li>
    );

    return (
        <div className="ui">
            <PageHeader
                eyebrow="Projects"
                title="Partner assignment"
                description="Add many partners to a project, or many projects to a partner, and keep every partner's capacity up to date."
                actions={
                    <LinkButton href="/partners/registration">
                        <UserPlus className="tw-h-4 tw-w-4" aria-hidden /> Register partner
                    </LinkButton>
                }
            />

            <div className="tw-mb-4 tw-w-fit">
                <Segmented<Mode>
                    label="Work from"
                    value={mode}
                    onChange={switchMode}
                    options={[
                        { value: 'project', label: 'By project' },
                        { value: 'partner', label: 'By partner' },
                    ]}
                />
            </div>

            {!data ? (
                <Card className="tw-space-y-3 tw-p-5" aria-busy="true">
                    {[0, 1, 2, 3].map((i) => (
                        <Skeleton key={i} className="tw-h-6 tw-w-full" />
                    ))}
                </Card>
            ) : (
                <div className="tw-grid tw-grid-cols-1 tw-items-start tw-gap-6 lg:tw-grid-cols-[20rem_minmax(0,1fr)]">
                    <Card className="tw-overflow-hidden lg:tw-sticky lg:tw-top-24">
                        <div className="tw-border-b tw-border-slate-100 tw-p-3">
                            <SearchInput placeholder={mode === 'project' ? 'Search projects' : 'Search partners'} value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search the list" />
                        </div>
                        <ul className="tw-max-h-[22rem] tw-divide-y tw-divide-slate-100 tw-overflow-y-auto lg:tw-max-h-[calc(100vh-15rem)]">
                            {mode === 'project'
                                ? leftProjects.map((p) =>
                                      listButton(
                                          p.idProjects,
                                          p.idProjects === idProject,
                                          () => chooseProject(p.idProjects),
                                          <>
                                              <span className="tw-flex tw-items-start tw-justify-between tw-gap-2">
                                                  <span className="tw-min-w-0 tw-truncate tw-text-sm tw-font-medium tw-text-slate-900">{p.projectName}</span>
                                                  {p.level !== 'ok' && <span className="tw-shrink-0"><CapacityPill level={p.level} /></span>}
                                              </span>
                                              <CapacityBar className="tw-mt-1.5" confirmed={p.confirmed} pending={p.pending} limit={p.limit} level={p.level} />
                                              <span className="tw-mt-1 tw-block tw-text-xs tw-tabular-nums tw-text-slate-500">
                                                  {p.partners} partner{p.partners === 1 ? '' : 's'} · {p.left === null ? 'no limit' : `${p.left} of ${p.limit} left`}
                                              </span>
                                          </>,
                                      ),
                                  )
                                : leftPartners.map((p) =>
                                      listButton(
                                          p.idUsers,
                                          p.idUsers === idPartner,
                                          () => choosePartner(p.idUsers),
                                          <span className="tw-flex tw-items-center tw-gap-2.5">
                                              <Avatar name={p.fullName || '?'} seed={p.idUsers} size="sm" />
                                              <span className="tw-min-w-0">
                                                  <span className="tw-block tw-truncate tw-text-sm tw-font-medium tw-text-slate-900">{p.fullName}</span>
                                                  <span className="tw-block tw-truncate tw-text-xs tw-text-slate-500">
                                                      {countFor.get(p.idUsers) ?? 0} project(s){p.location ? ` · ${p.location}` : ''}
                                                  </span>
                                              </span>
                                          </span>,
                                      ),
                                  )}
                        </ul>
                    </Card>

                    <div className="tw-min-w-0 tw-space-y-6">
                        {mode === 'project' &&
                            (!project ? (
                                <Card className="tw-py-16 tw-text-center tw-text-sm tw-text-slate-500">Choose a project. The ones needing attention are listed first.</Card>
                            ) : (
                                <>
                                    <Card className="tw-p-5">
                                        <div className="tw-flex tw-flex-wrap tw-items-start tw-justify-between tw-gap-3">
                                            <div className="tw-min-w-0">
                                                <h2 className="tw-text-base tw-font-semibold tw-text-slate-900">{project.projectName}</h2>
                                                <p className="tw-text-xs tw-text-slate-500">
                                                    {project.duration} {project.tenure} · {bdt(project.unitValue)} per unit{project.location ? ` · ${project.location}` : ''}
                                                </p>
                                            </div>
                                            <span className="tw-flex tw-items-center tw-gap-2">
                                                <CapacityPill level={project.level} />
                                                <Link href={`/projects/details/${project.idProjects}`} className="tw-inline-flex tw-items-center tw-gap-1 tw-text-xs tw-font-semibold tw-text-brand-700 hover:tw-underline">
                                                    Open <ArrowUpRight className="tw-h-3.5 tw-w-3.5" aria-hidden />
                                                </Link>
                                            </span>
                                        </div>
                                        <dl className="tw-mt-4 tw-grid tw-grid-cols-2 tw-gap-4 sm:tw-grid-cols-5">
                                            <Stat label="Project total" value={project.totalUnits || 'No total'} />
                                            <Stat label="Partners can hold" value={project.partnerCapacity ?? 'No limit'} />
                                            <Stat label="Paid" value={project.confirmed} />
                                            <Stat label="Awaiting payment" value={project.pending} />
                                            <Stat label="Units left" value={project.left ?? 'No limit'} tone={project.left === 0 ? 'tw-text-rose-700' : 'tw-text-brand-700'} />
                                        </dl>
                                        <CapacityBar className="tw-mt-4" confirmed={project.confirmed} pending={project.pending} limit={project.limit} level={project.level} />
                                        {project.gap > 0 && (
                                            <p className="tw-mt-3 tw-flex tw-items-start tw-gap-2 tw-rounded-xl tw-bg-amber-50 tw-px-3 tw-py-2 tw-text-xs tw-text-amber-800">
                                                <AlertTriangle className="tw-mt-px tw-h-3.5 tw-w-3.5 tw-shrink-0" aria-hidden />
                                                The project offers {project.totalUnits} units but its partners can hold {project.partnerCapacity}. Add {project.gap} units of partner capacity, or lower the total on the project.
                                            </p>
                                        )}
                                    </Card>

                                    <TableCard toolbar={<p className="tw-text-sm tw-font-semibold tw-text-slate-900">Partners on this project ({onProject.length})</p>}>
                                        <thead>
                                            <tr>
                                                <th className={TH}>Partner</th>
                                                <th className={TH}>Used</th>
                                                <th className={cx(TH, 'tw-text-right')}>Left</th>
                                                <th className={cx(TH, 'tw-text-right')}>Capacity</th>
                                                <th className={TH}><span className="tw-sr-only">Remove</span></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {onProject.length === 0 ? (
                                                <EmptyRow colSpan={5} title="No partners yet" hint="Add them below, or copy another project's set." />
                                            ) : (
                                                onProject.map((row) => (
                                                    <tr key={row.idProjectPartners} className={TR}>
                                                        <td className={TD}>
                                                            <button type="button" onClick={() => { switchMode('partner'); choosePartner(row.idUsers); }} className="tw-flex tw-items-center tw-gap-2.5 tw-text-left">
                                                                <Avatar name={row.fullName || '?'} seed={row.idUsers} size="sm" />
                                                                <span className="tw-font-medium tw-text-slate-900 hover:tw-text-brand-700">{row.fullName}</span>
                                                            </button>
                                                        </td>
                                                        {rowCells(row)}
                                                        {removeCell(row, row.fullName)}
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </TableCard>

                                    {isOpenProject(project.projectStatus) ? (
                                        <Card className="tw-p-5">
                                            <h3 className="tw-text-sm tw-font-semibold tw-text-slate-900">Add partners</h3>
                                            <Field label="Copy partners from another project" className="tw-mt-3 tw-max-w-md" hint="Selects its partners with their capacity. Change anything before adding.">
                                                <Select value={copyFrom} onChange={(e) => applyCopy(e.target.value)}>
                                                    <option value="">Don&apos;t copy</option>
                                                    {copySources.map((p) => (
                                                        <option key={p.idProjects} value={p.idProjects}>
                                                            {p.projectName} ({p.partners} partners)
                                                        </option>
                                                    ))}
                                                </Select>
                                            </Field>
                                            <div className="tw-mt-4">
                                                <UnitsPicker items={addablePartners} picked={picked} onChange={setPicked} noun="partners" emptyText="Every partner is already on this project." />
                                            </div>
                                            <div className="tw-mt-4 tw-flex tw-flex-wrap tw-items-center tw-justify-between tw-gap-3 tw-border-t tw-border-slate-100 tw-pt-4">
                                                <p className="tw-text-xs tw-text-slate-500">
                                                    {preview.rows.length ? `${preview.rows.length} partner(s)${addedUnits ? `, ${addedUnits} units of capacity` : ''}` : 'Nothing selected'}
                                                    {previewTotal ? `. Project total ${previewTotal.from} → ${previewTotal.to}.` : ''}
                                                </p>
                                                <Button variant="primary" onClick={submitAdd} disabled={saving || preview.rows.length === 0}>
                                                    {saving ? <Loader2 className="tw-h-4 tw-w-4 tw-animate-spin" aria-hidden /> : copyFrom ? <Copy className="tw-h-4 tw-w-4" aria-hidden /> : <Network className="tw-h-4 tw-w-4" aria-hidden />}
                                                    Add {preview.rows.length || ''} partner{preview.rows.length === 1 ? '' : 's'}
                                                </Button>
                                            </div>
                                        </Card>
                                    ) : (
                                        <Card className="tw-p-5 tw-text-sm tw-text-slate-500">This project is closed, so no partners can be added.</Card>
                                    )}
                                </>
                            ))}

                        {mode === 'partner' &&
                            (!partner ? (
                                <Card className="tw-py-16 tw-text-center tw-text-sm tw-text-slate-500">Choose a partner to see their projects and capacity.</Card>
                            ) : (
                                <>
                                    <Card className="tw-p-5">
                                        <div className="tw-flex tw-flex-wrap tw-items-center tw-justify-between tw-gap-3">
                                            <div className="tw-flex tw-min-w-0 tw-items-center tw-gap-3">
                                                <Avatar name={partner.fullName || '?'} seed={partner.idUsers} />
                                                <div className="tw-min-w-0">
                                                    <h2 className="tw-truncate tw-text-base tw-font-semibold tw-text-slate-900">{partner.fullName}</h2>
                                                    <p className="tw-truncate tw-text-xs tw-text-slate-500">{[partner.phoneNumber, partner.location].filter(Boolean).join(' · ') || '—'}</p>
                                                </div>
                                            </div>
                                            <Link href={`/partners/details/${partner.idUsers}`} className="tw-inline-flex tw-items-center tw-gap-1 tw-text-xs tw-font-semibold tw-text-brand-700 hover:tw-underline">
                                                Open profile <ArrowUpRight className="tw-h-3.5 tw-w-3.5" aria-hidden />
                                            </Link>
                                        </div>
                                        <dl className="tw-mt-4 tw-grid tw-grid-cols-2 tw-gap-4 sm:tw-grid-cols-4">
                                            <Stat label="Projects" value={ofPartner.length} />
                                            <Stat label="Capacity" value={ofPartner.reduce((s, r) => s + r.capacity, 0)} />
                                            <Stat label="Paid" value={ofPartner.reduce((s, r) => s + r.confirmed, 0)} />
                                            <Stat label="Awaiting payment" value={ofPartner.reduce((s, r) => s + r.pending, 0)} />
                                        </dl>
                                    </Card>

                                    <TableCard toolbar={<p className="tw-text-sm tw-font-semibold tw-text-slate-900">Their projects ({ofPartner.length})</p>}>
                                        <thead>
                                            <tr>
                                                <th className={TH}>Project</th>
                                                <th className={TH}>Used</th>
                                                <th className={cx(TH, 'tw-text-right')}>Left</th>
                                                <th className={cx(TH, 'tw-text-right')}>Capacity</th>
                                                <th className={TH}><span className="tw-sr-only">Remove</span></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {ofPartner.length === 0 ? (
                                                <EmptyRow colSpan={5} title="Not on any project yet" hint="Add projects below." />
                                            ) : (
                                                ofPartner.map((row) => {
                                                    const p = projects.find((x) => x.idProjects === row.idProjects);
                                                    return (
                                                        <tr key={row.idProjectPartners} className={TR}>
                                                            <td className={TD}>
                                                                <button type="button" onClick={() => { switchMode('project'); chooseProject(row.idProjects); }} className="tw-text-left tw-font-medium tw-text-slate-900 hover:tw-text-brand-700">
                                                                    {p?.projectName ?? `Project #${row.idProjects}`}
                                                                </button>
                                                                {p && !isOpenProject(p.projectStatus) && <span className="tw-ml-2 tw-text-xs tw-text-slate-400">closed</span>}
                                                            </td>
                                                            {rowCells(row)}
                                                            {removeCell(row, p?.projectName ?? 'this project')}
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </TableCard>

                                    <Card className="tw-p-5">
                                        <h3 className="tw-mb-3 tw-text-sm tw-font-semibold tw-text-slate-900">Add to projects</h3>
                                        <UnitsPicker items={addableProjects} picked={picked} onChange={setPicked} noun="projects" emptyText="This partner is on every open project." />
                                        <div className="tw-mt-4 tw-flex tw-flex-wrap tw-items-center tw-justify-between tw-gap-3 tw-border-t tw-border-slate-100 tw-pt-4">
                                            <p className="tw-text-xs tw-text-slate-500">{preview.rows.length ? `${preview.rows.length} project(s)${addedUnits ? `, ${addedUnits} units of capacity` : ''}` : 'Nothing selected'}</p>
                                            <Button variant="primary" onClick={submitAdd} disabled={saving || preview.rows.length === 0}>
                                                {saving ? <Loader2 className="tw-h-4 tw-w-4 tw-animate-spin" aria-hidden /> : <Network className="tw-h-4 tw-w-4" aria-hidden />}
                                                Add to {preview.rows.length || ''} project{preview.rows.length === 1 ? '' : 's'}
                                            </Button>
                                        </div>
                                    </Card>
                                </>
                            ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default PartnerAssign;

PartnerAssign.getLayout = function PageLayout(page: any) {
    return <MainLayout>{page}</MainLayout>;
};
