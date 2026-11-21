import React, { useState, useEffect } from "react";
import MainLayout from "@/layouts/MainLayout";
import Swal from 'sweetalert2';
import { API_URL } from '@/config/public';
import { getRequestOptions, postRequestOptions } from '@/utils/Fetch';
import { Pencil } from 'lucide-react';
import { cx } from '@/ui/primitives';
import { Button, Field, Input, Required } from '@/ui/controls';
import { EmptyRow, TableCard, TD, TH, TR } from '@/ui/layout';
import { ListFooter, ListToolbar, SortTH, useListState } from '@/ui/table';
import { SetupFormCard, SetupShell } from '@/components/setup/SetupShell';

interface FormDataType {
    idUnit?: number
    unitName: string
    unitCode: string
}

const DEFAULTS = {
    q: '',
    orderBy: 'idUnit',
    orderType: 'ASC' as 'ASC' | 'DESC',
    page: 1,
    pageSize: 10,
};

function Unit() {
    const [idUnit, setIdUnit] = useState<number>(0);
    const [formData, setFormData] = useState<FormDataType>({
        unitName: '',
        unitCode: ''
    });
    const list = useListState(DEFAULTS);
    const { state, update } = list;
    const [total, setTotal] = useState<number>(0);
    const [unitList, setUnitList] = useState<FormDataType[]>([]);
    const [reloadKey, setReloadKey] = useState<number>(0);
    const [loading, setLoading] = useState<boolean>(false);

    useEffect(() => {
        if (!list.ready) return;
        // Ignore answers a newer request replaced.
        let stale = false;
        const fetchUnitList = async () => {
            try {
                const res = await fetch(`/api/unit/list?${list.query}`, getRequestOptions());
                const data = await res.json();
                if (stale) return;
                if (res.status === 200) {
                    setUnitList(data.data);
                    setTotal(Number(data.total) || 0);
                } else {
                    Swal.fire({ icon: 'error', title: 'Error', text: data.message });
                }
            } catch (err: any) {
                if (!stale) Swal.fire({ icon: 'error', title: 'Error', text: err.message });
            }
        }
        fetchUnitList();
        return () => {
            stale = true;
        };
    }, [list.query, list.ready, reloadKey]);

    const handleEditChange = (unit: FormDataType) => () => {
        setIdUnit(unit.idUnit ?? 0);
        setFormData({
            unitName: unit.unitName,
            unitCode: unit.unitCode
        });
    }

    const cancelEdit = () => {
        setIdUnit(0);
        setFormData({ unitName: '', unitCode: '' });
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        Swal.fire({
            title: 'Are you sure?',
            text: `You want to ${idUnit !== 0 ? 'update' : 'create'} this unit!`,
            icon: 'warning',
            showCancelButton: true,
            cancelButtonText: 'No',
            confirmButtonText: 'Yes'
        }).then(async (result) => {
            if (result.value) {
                try {
                    const api = idUnit !== 0 ? `api/unit/update/${idUnit}` : 'api/unit/create';
                    const res = await fetch(API_URL + api, postRequestOptions(formData));
                    if (res.status === 200) {
                        Swal.fire({
                            icon: 'success',
                            title: 'Success',
                            text: (await res.json()).message,
                        });
                        setReloadKey((k) => k + 1);
                        setIdUnit(0);
                        setFormData({
                            unitName: '',
                            unitCode: ''
                        });
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

    return (
        <SetupShell
            title="Units"
            description="Units the Mart sells products in: kilograms, litres, pieces."
            list={
                <TableCard
                    toolbar={<ListToolbar search={state.q} onSearch={(q) => update({ q }, { typing: true })} placeholder="Unit name, code or #" onReset={() => list.reset()} />}
                    footer={<ListFooter page={state.page} pageSize={state.pageSize} total={total} noun="units" onPage={(page) => update({ page })} onPageSize={(pageSize) => update({ pageSize })} />}
                >
                    <thead>
                        <tr>
                            <SortTH label="#" field="idUnit" sort={state} onSort={list.sortBy} className="tw-w-20" />
                            <SortTH label="Unit" field="unitName" sort={state} onSort={list.sortBy} />
                            <SortTH label="Code" field="unitCode" sort={state} onSort={list.sortBy} />
                            <th className={cx(TH, 'tw-text-right')}>
                                <span className="tw-sr-only">Edit</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {unitList.length > 0 ? unitList.map((unit, index) => (
                            <tr key={unit.idUnit ?? index} className={cx(TR, idUnit !== 0 && idUnit === unit.idUnit && 'tw-bg-brand-50/50')}>
                                <td className={cx(TD, 'tw-tabular-nums tw-text-slate-400')}>{unit.idUnit}</td>
                                <td className={cx(TD, 'tw-font-medium tw-text-slate-900')}>{unit.unitName}</td>
                                <td className={cx(TD, 'tw-font-mono tw-text-xs tw-text-slate-600')}>{unit.unitCode}</td>
                                <td className={cx(TD, 'tw-text-right')}>
                                    <Button size="sm" variant="ghost" onClick={handleEditChange(unit)}>
                                        <Pencil className="tw-h-3.5 tw-w-3.5" aria-hidden /> Edit
                                    </Button>
                                </td>
                            </tr>
                        )) : (
                            <EmptyRow colSpan={4} title="No units match" hint={state.q ? 'Try a different search.' : undefined} />
                        )}
                    </tbody>
                </TableCard>
            }
            form={
                <SetupFormCard noun="unit" editingId={idUnit} onCancelEdit={cancelEdit} onSubmit={handleSubmit} loading={loading}>
                    <Field label={<>Unit name<Required /></>}>
                        <Input type="text" name="unitName" placeholder="e.g. Kilogram" value={formData.unitName} onChange={(e) => setFormData({ ...formData, unitName: e.target.value })} required />
                    </Field>
                    <Field label={<>Code<Required /></>}>
                        <Input type="text" name="unitCode" placeholder="e.g. kg" value={formData.unitCode} onChange={(e) => setFormData({ ...formData, unitCode: e.target.value })} required />
                    </Field>
                </SetupFormCard>
            }
        />
    )
}

export default Unit;

Unit.getLayout = function PageLayout(page: any) {
    return (
        <MainLayout>
            {page}
        </MainLayout>
    )
}
