import React, { useState, useEffect } from "react";
import MainLayout from "@/layouts/MainLayout";
import Swal from 'sweetalert2';
import { API_URL } from '@/config/public';
import { getRequestOptions, postRequestOptions } from '@/utils/Fetch';
import { cx } from '@/ui/primitives';
import { Field, Input, Required } from '@/ui/controls';
import { EmptyRow, TableCard, TD, TR } from '@/ui/layout';
import { ListFooter, ListToolbar, SortTH, useListState } from '@/ui/table';
import { SetupFormCard, SetupShell } from '@/components/setup/SetupShell';

interface FormDataType {
    idSkills?: number
    skillName: string
}

const DEFAULTS = {
    q: '',
    orderBy: 'idSkills',
    orderType: 'ASC' as 'ASC' | 'DESC',
    page: 1,
    pageSize: 10,
};

function Skill() {
    const [formData, setFormData] = useState<FormDataType>({
        skillName: '',
    });
    const list = useListState(DEFAULTS);
    const { state, update } = list;
    const [total, setTotal] = useState<number>(0);
    const [skillList, setSkillList] = useState<FormDataType[]>([]);
    const [reloadKey, setReloadKey] = useState<number>(0);
    const [loading, setLoading] = useState<boolean>(false);

    useEffect(() => {
        if (!list.ready) return;
        // Ignore answers a newer request replaced.
        let stale = false;
        const fetchSkillList = async () => {
            try {
                const res = await fetch(`/api/skills/list?${list.query}`, getRequestOptions());
                const data = await res.json();
                if (stale) return;
                if (res.status === 200) {
                    setSkillList(data.data);
                    setTotal(Number(data.total) || 0);
                } else {
                    Swal.fire({ icon: 'error', title: 'Error', text: data.message });
                }
            } catch (err: any) {
                if (!stale) Swal.fire({ icon: 'error', title: 'Error', text: err.message });
            }
        }
        fetchSkillList();
        return () => {
            stale = true;
        };
    }, [list.query, list.ready, reloadKey]);

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        Swal.fire({
            title: 'Are you sure?',
            text: "You want to create this skill!",
            icon: 'warning',
            showCancelButton: true,
            cancelButtonText: 'No',
            confirmButtonText: 'Yes'
        }).then(async (result) => {
            if (result.value) {
                try {
                    const res = await fetch(API_URL + 'api/skills/create', postRequestOptions(formData));
                    if (res.status === 200) {
                        Swal.fire({
                            icon: 'success',
                            title: 'Success',
                            text: (await res.json()).message,
                        });
                        setReloadKey((k) => k + 1);
                        setFormData({
                            skillName: '',
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
            title="Skills"
            description="The skills partners can be tagged with when they are registered."
            list={
                <TableCard
                    toolbar={<ListToolbar search={state.q} onSearch={(q) => update({ q }, { typing: true })} placeholder="Search skills or #" onReset={() => list.reset()} />}
                    footer={<ListFooter page={state.page} pageSize={state.pageSize} total={total} noun="skills" onPage={(page) => update({ page })} onPageSize={(pageSize) => update({ pageSize })} />}
                >
                    <thead>
                        <tr>
                            <SortTH label="#" field="idSkills" sort={state} onSort={list.sortBy} className="tw-w-20" />
                            <SortTH label="Skill" field="skillName" sort={state} onSort={list.sortBy} />
                        </tr>
                    </thead>
                    <tbody>
                        {skillList.length > 0 ? skillList.map((skill, index) => (
                            <tr key={skill.idSkills ?? index} className={TR}>
                                <td className={cx(TD, 'tw-tabular-nums tw-text-slate-400')}>{skill.idSkills}</td>
                                <td className={cx(TD, 'tw-font-medium tw-text-slate-900')}>{skill.skillName}</td>
                            </tr>
                        )) : (
                            <EmptyRow colSpan={2} title="No skills match" hint={state.q ? 'Try a different search.' : undefined} />
                        )}
                    </tbody>
                </TableCard>
            }
            form={
                <SetupFormCard noun="skill" onSubmit={handleSubmit} loading={loading}>
                    <Field label={<>Skill name<Required /></>}>
                        <Input type="text" name="skillName" placeholder="e.g. Cattle rearing" value={formData.skillName} onChange={(e) => setFormData({ ...formData, skillName: e.target.value })} required />
                    </Field>
                </SetupFormCard>
            }
        />
    )
}

export default Skill;

Skill.getLayout = function PageLayout(page: any) {
    return (
        <MainLayout>
            {page}
        </MainLayout>
    )
}
