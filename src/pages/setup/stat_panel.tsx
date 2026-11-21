import React, { useState, useEffect, useRef } from "react";
import MainLayout from "@/layouts/MainLayout";
import Swal from 'sweetalert2';
import { API_URL } from '@/config/public';
import { getCookie } from '@/utils/GetCookie';
import { getRequestOptions } from '@/utils/Fetch';
import { S3_URL } from '@/config/public';
import { ImageOff, Pencil, Trash2 } from 'lucide-react';
import { Pill, SafeImg, Segmented, cx } from '@/ui/primitives';
import { Button, Field, FileInput, Input, Required } from '@/ui/controls';
import { EmptyRow, TableCard, TD, TH, TR } from '@/ui/layout';
import { ListFooter, ListToolbar, SortTH, useListState } from '@/ui/table';
import { SetupFormCard, SetupShell } from '@/components/setup/SetupShell';
import { LocalPreview } from '@/components/projects/ProjectFormParts';

interface FormDataType {
    idAppStatPanel?: number
    statType: string
    statLabel: string
    statValue: string | number | File
    priority: number | null
    statLabelBn: string
    /** Only meaningful for statType 'text' / 'number' — an image value is a filename. */
    statValueBn: string
}

const DEFAULTS = {
    q: '',
    statType: '',
    orderBy: 'idAppStatPanel',
    orderType: 'DESC' as 'ASC' | 'DESC',
    page: 1,
    pageSize: 10,
};

const EMPTY_FORM: FormDataType = {
    idAppStatPanel: undefined,
    statType: 'text',
    statLabel: '',
    statValue: '',
    priority: null,
    statLabelBn: '',
    statValueBn: ''
};

function StatPanel() {
    const [formData, setFormData] = useState<FormDataType>(EMPTY_FORM);
    const list = useListState(DEFAULTS);
    const { state, update } = list;
    const [total, setTotal] = useState<number>(0);
    const [statPanelList, setStatPanelList] = useState<FormDataType[]>([]);
    const [reloadKey, setReloadKey] = useState<number>(0);
    const [loading, setLoading] = useState<boolean>(false);
    const [isEditing, setIsEditing] = useState<boolean>(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!list.ready) return;
        // Ignore answers a newer request replaced.
        let stale = false;
        const fetchAppStatPanelList = async () => {
            try {
                const res = await fetch(`/api/stat-panels/list?${list.query}`, getRequestOptions());
                const data = await res.json();
                if (stale) return;
                if (res.status === 200) {
                    // A delete can empty the last page: go to the new last page.
                    if (data.data.length === 0 && list.settled.page > 1 && Number(data.total) > 0) {
                        update({ page: Math.ceil(Number(data.total) / list.settled.pageSize) });
                        return;
                    }
                    setStatPanelList(data.data);
                    setTotal(Number(data.total) || 0);
                } else {
                    Swal.fire({ icon: 'error', title: 'Error', text: data.message });
                }
            } catch (err: any) {
                if (!stale) Swal.fire({ icon: 'error', title: 'Error', text: err.message });
            }
        }
        fetchAppStatPanelList();
        return () => {
            stale = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [list.query, list.ready, reloadKey]);

    const handleStatTypeChange = (statType: string) => {
        setFormData({ ...formData, statType, statValue: '' });
    }

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const fileType = file.type;
            const validImageTypes = ['image/jpeg', 'image/png', 'image/jpg'];
            if (validImageTypes.includes(fileType)) {
                setFormData({ ...formData, statValue: file });
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Invalid file type. Please upload a jpeg, jpg, or png image.',
                });
            }
        }
    }

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true); // Set loading to true before the Swal confirmation

        Swal.fire({
            title: 'Are you sure?',
            text: isEditing ? "You want to update this stat!" : "You want to create this stat!",
            icon: 'warning',
            showCancelButton: true,
            cancelButtonText: 'No',
            confirmButtonText: 'Yes'
        }).then(async (result) => {
            if (result.value) {
                const newFormData = new FormData();
                if (isEditing && formData.idAppStatPanel) {
                    newFormData.append('idAppStatPanel', formData.idAppStatPanel.toString());
                }
                newFormData.append('statType', formData.statType);
                newFormData.append('statLabel', formData.statLabel);
                newFormData.append('statLabelBn', formData.statLabelBn || '');
                // An image row's value is a filename, so there is nothing to translate.
                if (formData.statType !== 'image') {
                    newFormData.append('statValueBn', formData.statValueBn || '');
                }

                // Append statValue based on statType
                if (formData.statType === 'number') {
                    newFormData.append('statValue', formData.statValue.toString());
                } else if (formData.statType === 'image') {
                    // Only send a file when a new image is selected.
                    if (formData.statValue instanceof File) {
                        newFormData.append('statValue', formData.statValue);
                    }
                } else {
                    newFormData.append('statValue', formData.statValue as string);
                }

                newFormData.append('priority', formData.priority?.toString() || '');

                try {
                    const url = isEditing ? API_URL + 'api/stat-panels/update' : API_URL + 'api/stat-panels/create';
                    const res = await fetch(url, {
                        method: 'POST',
                        headers: { 'Authorization': 'Bearer ' + getCookie('saathi-token') },
                        body: newFormData,
                    });

                    if (res.status === 200) {
                        Swal.fire({
                            icon: 'success',
                            title: 'Success',
                            text: (await res.json()).message,
                        });
                        setReloadKey((k) => k + 1);
                        setFormData(EMPTY_FORM);
                        setIsEditing(false);
                        if (fileInputRef.current) {
                            fileInputRef.current.value = '';  // Clear file input
                        }
                    } else {
                        Swal.fire({
                            icon: 'error',
                            title: 'Error',
                            html: (await res.json()).message,
                        });
                    }
                } catch (err) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: 'Something went wrong!',
                    });
                } finally {
                    setLoading(false);
                }
            } else {
                setLoading(false);
            }
        });
    };

    const handleEdit = (panel: FormDataType) => {
        setFormData({
            idAppStatPanel: panel.idAppStatPanel,
            statType: panel.statType,
            statLabel: panel.statLabel,
            // For image, keep existing filename so we can show a preview.
            statValue: panel.statType === 'image' ? panel.statValue : (panel.statValue ?? ''),
            priority: panel.priority,
            statLabelBn: panel.statLabelBn || '',
            statValueBn: panel.statValueBn || ''
        });
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
        setIsEditing(true);
    };

    const cancelEdit = () => {
        setFormData(EMPTY_FORM);
        setIsEditing(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleDelete = async (id?: number) => {
        if (!id) return;
        Swal.fire({
            title: 'Are you sure?',
            text: "You want to delete this stat!",
            icon: 'warning',
            showCancelButton: true,
            cancelButtonText: 'No',
            confirmButtonText: 'Yes'
        }).then(async (result) => {
            if (result.value) {
                try {
                    const res = await fetch(API_URL + `api/stat-panels/delete?idAppStatPanel=${id}`, {
                        method: 'DELETE',
                        headers: { 'Authorization': 'Bearer ' + getCookie('saathi-token') },
                    });
                    const data = await res.json();
                    if (res.status === 200) {
                        Swal.fire({
                            icon: 'success',
                            title: 'Success',
                            text: data.message,
                        });
                        setReloadKey((k) => k + 1);
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
                        text: err.message || 'Something went wrong!',
                    });
                }
            }
        });
    };

    const anyFilter = state.statType !== '' || state.q !== '';

    return (
        <SetupShell
            title="Stat panel"
            description="The figures shown on the app's home screen, in priority order: text, a number, or an image."
            list={
                <TableCard
                    toolbar={
                        <ListToolbar
                            search={state.q}
                            onSearch={(q) => update({ q }, { typing: true })}
                            placeholder="Label or value (English or বাংলা), or #"
                            onReset={() => list.reset()}
                            left={
                                <Segmented
                                    label="Type"
                                    value={state.statType}
                                    onChange={(statType) => update({ statType })}
                                    options={[
                                        { value: '', label: 'All' },
                                        { value: 'text', label: 'Text' },
                                        { value: 'number', label: 'Number' },
                                        { value: 'image', label: 'Image' },
                                    ]}
                                />
                            }
                        />
                    }
                    footer={<ListFooter page={state.page} pageSize={state.pageSize} total={total} noun="stats" onPage={(page) => update({ page })} onPageSize={(pageSize) => update({ pageSize })} />}
                >
                    <thead>
                        <tr>
                            <SortTH label="Label" field="statLabel" sort={state} onSort={list.sortBy} />
                            <th className={TH}>Value</th>
                            <SortTH label="Type" field="statType" sort={state} onSort={list.sortBy} />
                            <SortTH label="Priority" field="priority" sort={state} onSort={list.sortBy} align="right" />
                            <th className={cx(TH, 'tw-text-right')}>
                                <span className="tw-sr-only">Actions</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {statPanelList.length > 0 ? statPanelList.map((panel, index) => (
                            <tr key={panel.idAppStatPanel ?? index} className={cx(TR, isEditing && formData.idAppStatPanel === panel.idAppStatPanel && 'tw-bg-brand-50/50')}>
                                <td className={TD}>
                                    <div className="tw-font-medium tw-text-slate-900">{panel.statLabel}</div>
                                    <div className="tw-text-xs tw-tabular-nums tw-text-slate-400">#{panel.idAppStatPanel}</div>
                                </td>
                                <td className={TD}>
                                    {(panel.statType === 'image' && typeof panel.statValue === 'string') ? (
                                        <SafeImg
                                            src={`${S3_URL}stat-panel/${panel.statValue}`}
                                            alt={panel.statLabel}
                                            className="tw-h-12 tw-w-12 tw-rounded-lg tw-object-cover tw-ring-1 tw-ring-slate-200"
                                            fallback={
                                                <span className="tw-flex tw-h-12 tw-w-12 tw-items-center tw-justify-center tw-rounded-lg tw-bg-slate-50 tw-text-slate-300">
                                                    <ImageOff className="tw-h-4 tw-w-4" aria-hidden />
                                                </span>
                                            }
                                        />
                                    ) : (
                                        <span className="tw-tabular-nums tw-text-slate-800">{typeof panel.statValue === 'string' || typeof panel.statValue === 'number' ? panel.statValue : null}</span>
                                    )}
                                </td>
                                <td className={TD}>
                                    <Pill tone={panel.statType === 'image' ? 'violet' : panel.statType === 'number' ? 'sky' : 'slate'} dot={false}>
                                        {panel.statType.charAt(0).toUpperCase() + panel.statType.slice(1)}
                                    </Pill>
                                </td>
                                <td className={cx(TD, 'tw-text-right tw-tabular-nums')}>{panel.priority}</td>
                                <td className={cx(TD, 'tw-whitespace-nowrap tw-text-right')}>
                                    <div className="tw-inline-flex tw-gap-1">
                                        <Button size="sm" variant="ghost" onClick={() => handleEdit(panel)}>
                                            <Pencil className="tw-h-3.5 tw-w-3.5" aria-hidden /> Edit
                                        </Button>
                                        <button
                                            type="button"
                                            onClick={() => handleDelete(panel.idAppStatPanel)}
                                            className="tw-rounded-lg tw-p-2 tw-text-slate-400 hover:tw-bg-rose-50 hover:tw-text-rose-600"
                                            aria-label={`Delete ${panel.statLabel}`}
                                        >
                                            <Trash2 className="tw-h-3.5 tw-w-3.5" aria-hidden />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        )) : (
                            <EmptyRow colSpan={5} title="No stats match" hint={anyFilter ? 'Try fewer filters.' : undefined} />
                        )}
                    </tbody>
                </TableCard>
            }
            form={
                <SetupFormCard noun="stat" editingId={isEditing ? formData.idAppStatPanel : null} onCancelEdit={cancelEdit} onSubmit={handleSubmit} loading={loading}>
                    <div>
                        <p className="tw-mb-1.5 tw-text-xs tw-font-medium tw-text-slate-600">
                            Type<Required />
                        </p>
                        <Segmented
                            label="Stat type"
                            value={formData.statType}
                            onChange={handleStatTypeChange}
                            options={[
                                { value: 'text', label: 'Text' },
                                { value: 'number', label: 'Number' },
                                { value: 'image', label: 'Image' },
                            ]}
                        />
                    </div>
                    <Field label={<>Label<Required /></>}>
                        <Input type="text" placeholder="e.g. Partners supported" name="statLabel" onChange={(e) => setFormData({ ...formData, statLabel: e.target.value })} value={formData.statLabel} />
                    </Field>
                    {/* Bangla counterpart — optional; blank falls back to English. */}
                    <Field label="Label (বাংলা)" hint="Optional; falls back to the English label.">
                        <Input type="text" placeholder="বাংলায় লেবেল লিখুন" name="statLabelBn" lang="bn" onChange={(e) => setFormData({ ...formData, statLabelBn: e.target.value })} value={formData.statLabelBn} />
                    </Field>
                    {formData.statType === 'image' ? (
                        <div>
                            <Field label={<>Image<Required /></>}>
                                <FileInput accept="image/jpeg,image/png" name="statValue" onChange={handleFileUpload} ref={fileInputRef} />
                            </Field>
                            {formData.statValue instanceof File ? (
                                <LocalPreview file={formData.statValue} className="tw-mt-2 tw-h-24 tw-w-24 tw-rounded-xl tw-object-cover tw-ring-1 tw-ring-slate-200" />
                            ) : typeof formData.statValue === 'string' && formData.statValue ? (
                                <SafeImg
                                    src={`${S3_URL}stat-panel/${formData.statValue}`}
                                    alt={formData.statLabel}
                                    className="tw-mt-2 tw-h-24 tw-w-24 tw-rounded-xl tw-object-cover tw-ring-1 tw-ring-slate-200"
                                    fallback={null}
                                />
                            ) : null}
                        </div>
                    ) : (
                        <>
                            <Field label={<>Value<Required /></>}>
                                <Input
                                    type={formData.statType === 'number' ? 'number' : 'text'}
                                    placeholder={formData.statType === 'number' ? 'e.g. 250' : 'e.g. 12 districts'}
                                    name="statValue"
                                    onChange={(e) => setFormData({ ...formData, statValue: e.target.value })}
                                    value={formData.statValue as string}
                                />
                            </Field>
                            {/* Bangla value applies to text/number rows only — an image row's value is a filename, not copy. */}
                            <Field label="Value (বাংলা)" hint="Optional; falls back to the English value.">
                                <Input type="text" placeholder="বাংলায় মান লিখুন" name="statValueBn" lang="bn" onChange={(e) => setFormData({ ...formData, statValueBn: e.target.value })} value={formData.statValueBn} />
                            </Field>
                        </>
                    )}
                    <Field label={<>Priority<Required /></>} hint="Lower numbers show first.">
                        <Input type="number" placeholder="e.g. 1" name="priority" onChange={(e) => setFormData({ ...formData, priority: e.target.value ? parseInt(e.target.value) : null })} value={formData.priority || ''} />
                    </Field>
                </SetupFormCard>
            }
        />
    )
}

export default StatPanel;

StatPanel.getLayout = function PageLayout(page: any) {
    return (
        <MainLayout>
            {page}
        </MainLayout>
    )
}
