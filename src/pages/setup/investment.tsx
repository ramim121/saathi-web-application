import React, { useCallback, useState, useEffect } from 'react';
import { API_URL } from '@/config/public';
import MainLayout from '@/layouts/MainLayout';
import { getRequestOptions, postRequestOptions } from '@/utils/Fetch';
import Swal from 'sweetalert2';
import { Card, Pill, Segmented, Skeleton, cx } from '@/ui/primitives';
import { Field, Input, Required, Select } from '@/ui/controls';
import { EmptyRow, TableCard, TD, TH, TR } from '@/ui/layout';
import { ListFooter, ListToolbar, SortTH, filterChips, useClientRows, useListState } from '@/ui/table';
import { returnRange, words } from '@/ui/status';
import { SetupFormCard, SetupShell } from '@/components/setup/SetupShell';

interface FormDataType {
    idInvestmentSetup?: number,
    nameOfThePlan?: string,
    investmentType: string,
    returnType: string,
    minimumReturn: number,
    maximumReturn: number,
    duration: number,
    tenure: string,
    planName?: string,
}

// The endpoint returns every plan (a short list), so the table searches,
// filters, sorts and pages them here. No sort keeps the endpoint's order.
const DEFAULTS = {
    q: '',
    investmentType: '',
    returnType: '',
    orderBy: '',
    orderType: 'ASC' as 'ASC' | 'DESC',
    page: 1,
    pageSize: 10,
};

function Investment() {
    const [formData, setFormData] = useState<FormDataType>({
        nameOfThePlan: '',
        investmentType: '',
        returnType: 'variable',
        minimumReturn: 0,
        maximumReturn: 0,
        duration: 0,
        tenure: 'months',
    });
    const [investmentList, setInvestmentList] = useState<FormDataType[]>([]);
    const [reload, setReload] = useState<boolean>(true);
    const [loading, setLoading] = useState<boolean>(false);
    const [loaded, setLoaded] = useState<boolean>(false);

    const list = useListState(DEFAULTS);
    const { state, update } = list;
    const byFilters = useCallback(
        (plan: FormDataType) => (!state.investmentType || plan.investmentType === state.investmentType) && (!state.returnType || plan.returnType === state.returnType),
        [state.investmentType, state.returnType],
    );
    const { total, pageRows } = useClientRows(investmentList, state, {
        text: (plan) => `${plan.planName ?? ''} ${words(plan.investmentType)} ${plan.duration} ${plan.tenure}`,
        sort: {
            planName: (plan) => plan.planName ?? '',
            investmentType: (plan) => plan.investmentType,
            minimumReturn: (plan) => Number(plan.minimumReturn),
            // Years count as twelve months, so terms compare across units.
            duration: (plan) => Number(plan.duration) * (plan.tenure === 'years' ? 12 : 1),
        },
        filter: byFilters,
    });
    const chips = filterChips(state, list.defaults, {
        investmentType: (v) => words(v),
        returnType: (v) => `${words(v)} return`,
    }, update);

    const handleOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    }

    const handleInvestmentTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setFormData({ ...formData, investmentType: e.target.value });
    }

    const minimumReturnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (formData.returnType === 'fixed') {
            setFormData({ ...formData, minimumReturn: Number(e.target.value), maximumReturn: Number(e.target.value) });
        } else {
            setFormData({ ...formData, minimumReturn: Number(e.target.value) });
        }
    }

    const handleTenureChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setFormData({ ...formData, tenure: e.target.value });
    }

    const handleReturnTypeChange = (returnType: string) => {
        setFormData({ ...formData, returnType, maximumReturn: formData.minimumReturn });
    }

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        Swal.fire({
            title: 'Are you sure?',
            text: "You want to setup this investment!",
            icon: 'warning',
            showCancelButton: true,
            cancelButtonText: 'No',
            confirmButtonText: 'Yes'
        }).then(async (result) => {
            if (result.value) {
                try {
                    // Proceed with the API request
                    const res = await fetch(API_URL + 'api/investments/create', postRequestOptions(formData));
                    if (res.status === 200) {
                        Swal.fire({
                            icon: 'success',
                            title: 'Success',
                            text: 'Investment setup successful!',
                        });
                        // Reset form and reload the investment list
                        setFormData({
                            nameOfThePlan: '',
                            investmentType: '',
                            returnType: 'variable',
                            minimumReturn: 0,
                            maximumReturn: 0,
                            duration: 0,
                            tenure: 'months',
                        });
                        setReload(true);
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
    }

    useEffect(() => {
        const fetchInvestmentSetupList = async () => {
            try {
                const res = await fetch('/api/investments/list', getRequestOptions());
                const data = await res.json();
                if (res.status === 200) {
                    setInvestmentList(data.data);
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
            } finally {
                setLoaded(true);
            }
        }
        if (reload) {
            fetchInvestmentSetupList();
        }
    }, [reload]);

    const fixed = formData.returnType === 'fixed';

    return (
        <SetupShell
            title="Investment plans"
            description="The terms a project is built from: its type, return range and duration. A project picks one plan when it is created."
            list={
                !loaded ? (
                    <Card className="tw-space-y-3 tw-p-5">
                        {[0, 1, 2].map((i) => (
                            <Skeleton key={i} className="tw-h-5 tw-w-full" />
                        ))}
                    </Card>
                ) : (
                    <TableCard
                        toolbar={
                            <ListToolbar
                                search={state.q}
                                onSearch={(q) => update({ q })}
                                placeholder="Search plans"
                                chips={chips}
                                onReset={() => list.reset()}
                                filters={
                                    <>
                                        <Field label="Type">
                                            <Select {...list.bind('investmentType')}>
                                                <option value="">All</option>
                                                <option value="sustainable_return">Sustainable return</option>
                                                <option value="fast_return">Fast return</option>
                                            </Select>
                                        </Field>
                                        <Field label="Return">
                                            <Select {...list.bind('returnType')}>
                                                <option value="">All</option>
                                                <option value="variable">Variable</option>
                                                <option value="fixed">Fixed</option>
                                            </Select>
                                        </Field>
                                    </>
                                }
                            />
                        }
                        footer={<ListFooter page={state.page} pageSize={state.pageSize} total={total} noun="plans" onPage={(page) => update({ page })} onPageSize={(pageSize) => update({ pageSize })} />}
                    >
                        <thead>
                            <tr>
                                <th className={cx(TH, 'tw-w-12')}>#</th>
                                <SortTH label="Plan" field="planName" sort={state} onSort={list.sortBy} />
                                <SortTH label="Type" field="investmentType" sort={state} onSort={list.sortBy} />
                                <SortTH label="Return" field="minimumReturn" sort={state} onSort={list.sortBy} />
                                <SortTH label="Term" field="duration" sort={state} onSort={list.sortBy} />
                            </tr>
                        </thead>
                        <tbody>
                            {pageRows.length > 0 ? pageRows.map((investment, index) => (
                                <tr key={investment.idInvestmentSetup ?? index} className={TR}>
                                    <td className={cx(TD, 'tw-tabular-nums tw-text-slate-400')}>{(state.page - 1) * state.pageSize + index + 1}</td>
                                    <td className={cx(TD, 'tw-font-medium tw-text-slate-900')}>{investment.planName}</td>
                                    <td className={cx(TD, 'tw-text-slate-600')}>{words(investment.investmentType)}</td>
                                    <td className={cx(TD, 'tw-whitespace-nowrap')}>
                                        <span className="tw-font-medium tw-tabular-nums tw-text-slate-900">{returnRange(investment.minimumReturn, investment.maximumReturn)}</span>{' '}
                                        <Pill tone={investment.returnType === 'fixed' ? 'sky' : 'violet'} dot={false}>{words(investment.returnType)}</Pill>
                                    </td>
                                    <td className={cx(TD, 'tw-whitespace-nowrap tw-text-slate-600')}>{investment.duration} {investment.tenure}</td>
                                </tr>
                            )) : (
                                <EmptyRow colSpan={5} title={investmentList.length === 0 ? 'No plans yet' : 'No plans match'} hint={investmentList.length > 0 ? 'Try other words or fewer filters.' : undefined} />
                            )}
                        </tbody>
                    </TableCard>
                )
            }
            form={
                <SetupFormCard noun="plan" onSubmit={handleSubmit} loading={loading}>
                    <Field label={<>Plan name<Required /></>}>
                        <Input type="text" placeholder="e.g. Cattle 4 months" name="nameOfThePlan" onChange={handleOnChange} value={formData.nameOfThePlan} />
                    </Field>
                    <Field label={<>Investment type<Required /></>}>
                        <Select name="investmentType" onChange={handleInvestmentTypeChange} value={formData.investmentType}>
                            <option value="" disabled>
                                Choose a type
                            </option>
                            <option value="sustainable_return">Sustainable return</option>
                            <option value="fast_return">Fast return</option>
                        </Select>
                    </Field>
                    <div>
                        <p className="tw-mb-1.5 tw-text-xs tw-font-medium tw-text-slate-600">
                            Return type<Required />
                        </p>
                        <Segmented
                            label="Return type"
                            value={formData.returnType}
                            onChange={handleReturnTypeChange}
                            options={[
                                { value: 'variable', label: 'Variable (a range)' },
                                { value: 'fixed', label: 'Fixed' },
                            ]}
                        />
                    </div>
                    <div className={cx('tw-grid tw-gap-3', fixed ? 'tw-grid-cols-1' : 'tw-grid-cols-2')}>
                        <Field label={<>{fixed ? 'Return' : 'From'} (%)<Required /></>}>
                            <Input type="number" step="any" placeholder="e.g. 12" name="minimumReturn" onChange={minimumReturnChange} value={formData.minimumReturn || ''} />
                        </Field>
                        {!fixed && (
                            <Field label={<>To (%)<Required /></>}>
                                <Input type="number" step="any" placeholder="e.g. 14" name="maximumReturn" onChange={handleOnChange} value={formData.maximumReturn || ''} />
                            </Field>
                        )}
                    </div>
                    <div className="tw-grid tw-grid-cols-2 tw-gap-3">
                        <Field label={<>Duration<Required /></>}>
                            <Input type="number" placeholder="e.g. 4" name="duration" onChange={handleOnChange} value={formData.duration || ''} />
                        </Field>
                        <Field label="In">
                            <Select name="tenure" onChange={handleTenureChange} value={formData.tenure}>
                                <option value="months">Months</option>
                                <option value="years">Years</option>
                            </Select>
                        </Field>
                    </div>
                </SetupFormCard>
            }
        />
    );
}

export default Investment;

Investment.getLayout = function PageLayout(page: any) {
    return (
        <MainLayout>
            {page}
        </MainLayout>
    )
}
