import React, { useState, useEffect } from "react";
import MainLayout from "@/layouts/MainLayout";
import Swal from 'sweetalert2';
import { API_URL } from '@/config/public';
import { getRequestOptions, postRequestOptions } from '@/utils/Fetch';
import { Pencil } from 'lucide-react';
import { cx } from '@/ui/primitives';
import { Button, Field, Input, Required, SearchInput } from '@/ui/controls';
import { EmptyRow, Pager, TableCard, TD, TH, TR } from '@/ui/layout';
import { SetupFormCard, SetupShell } from '@/components/setup/SetupShell';

interface FormDataType {
    idUnit?: number
    unitName: string
    unitCode: string
}

interface FilterProps {
    idUnit: string
    unitName: string
    unitCode: string
    orderBy: string
    orderType: string
    page: number
    pageSize: number
}

function Unit() {
    const [idUnit, setIdUnit] = useState<number>(0);
    const [formData, setFormData] = useState<FormDataType>({
        unitName: '',
        unitCode: ''
    });
    const [filter, setFilter] = useState<FilterProps>({
        idUnit: '',
        unitName: '',
        unitCode: '',
        orderBy: 'idUnit',
        orderType: 'ASC',
        page: 1,
        pageSize: 10
    });
    const [total, setTotal] = useState<number>(0);
    const [totalPages, setTotalPages] = useState<number>(1);
    const [unitList, setUnitList] = useState<FormDataType[]>([]);
    const [reload, setReload] = useState<boolean>(true);
    const [loading, setLoading] = useState<boolean>(false);

    useEffect(() => {
        // A filter fires a request per keystroke; ignore answers a newer request replaced.
        let stale = false;
        const fetchUnitList = async () => {
            const query = new URLSearchParams(filter as any).toString();
            try {
                const res = await fetch(`/api/unit/list?${query}`, getRequestOptions());
                const data = await res.json();
                if (stale) return;
                if (res.status === 200) {
                    setUnitList(data.data);
                    setTotal(data.total);
                    setTotalPages(data.totalPages);
                    setReload(false);
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: data.message,
                    });
                }
            } catch (err: any) {
                if (stale) return;
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: err.message,
                });
            }
        }
        fetchUnitList();
        return () => {
            stale = true;
        };
    }, [filter, reload]);

    // A changed filter starts again from page 1.
    const handleInputOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
                        setReload(true);
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
                    toolbar={
                        <div className="tw-grid tw-grid-cols-[1fr_8rem_6rem] tw-gap-3">
                            <Field label="Unit">
                                <SearchInput placeholder="Search units" name="unitName" onChange={handleInputOnChange} value={filter.unitName} />
                            </Field>
                            <Field label="Code">
                                <Input placeholder="e.g. kg" name="unitCode" onChange={handleInputOnChange} value={filter.unitCode} />
                            </Field>
                            <Field label="#">
                                <Input type="number" placeholder="ID" name="idUnit" onChange={handleInputOnChange} value={filter.idUnit} />
                            </Field>
                        </div>
                    }
                    footer={<Pager page={filter.page} totalPages={pages} onChange={handlePageChange} summary={total ? `${total} units · page ${filter.page} of ${pages}` : undefined} />}
                >
                    <thead>
                        <tr>
                            <th className={cx(TH, 'tw-w-20')}>#</th>
                            <th className={TH}>Unit</th>
                            <th className={TH}>Code</th>
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
                            <EmptyRow colSpan={4} title="No units match" />
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
