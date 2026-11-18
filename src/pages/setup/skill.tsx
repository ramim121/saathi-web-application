import React, { useState, useEffect } from "react";
import MainLayout from "@/layouts/MainLayout";
import Swal from 'sweetalert2';
import { API_URL } from '@/config/public';
import { getRequestOptions, postRequestOptions } from '@/utils/Fetch';
import { cx } from '@/ui/primitives';
import { Field, Input, Required, SearchInput } from '@/ui/controls';
import { EmptyRow, Pager, TableCard, TD, TH, TR } from '@/ui/layout';
import { SetupFormCard, SetupShell } from '@/components/setup/SetupShell';

interface FormDataType {
    idSkills?: number
    skillName: string
}

interface FilterProps {
    idSkills: string
    skillName: string
    orderBy: string
    orderType: string
    page: number
    pageSize: number
}

function Skill() {
    const [formData, setFormData] = useState<FormDataType>({
        skillName: '',
    });
    const [filter, setFilter] = useState<FilterProps>({
        idSkills: '',
        skillName: '',
        orderBy: 'idSkills',
        orderType: 'ASC',
        page: 1,
        pageSize: 10
    });
    const [total, setTotal] = useState<number>(0);
    const [totalPages, setTotalPages] = useState<number>(1);
    const [skillList, setSkillList] = useState<FormDataType[]>([]);
    const [reload, setReload] = useState<boolean>(true);
    const [loading, setLoading] = useState<boolean>(false);

    useEffect(() => {
        // A filter fires a request per keystroke; ignore answers a newer request replaced.
        let stale = false;
        const fetchSkillList = async () => {
            const query = new URLSearchParams(filter as any).toString();
            try {
                const res = await fetch(`/api/skills/list?${query}`, getRequestOptions());
                const data = await res.json();
                if (stale) return;
                if (res.status === 200) {
                    setSkillList(data.data);
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
        fetchSkillList();
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
                        setReload(true);
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
                    toolbar={
                        <div className="tw-grid tw-grid-cols-[1fr_6rem] tw-gap-3">
                            <Field label="Skill">
                                <SearchInput placeholder="Search skills" name="skillName" onChange={handleInputOnChange} value={filter.skillName} />
                            </Field>
                            <Field label="#">
                                <Input type="number" placeholder="ID" name="idSkills" onChange={handleInputOnChange} value={filter.idSkills} />
                            </Field>
                        </div>
                    }
                    footer={<Pager page={filter.page} totalPages={pages} onChange={handlePageChange} summary={total ? `${total} skills · page ${filter.page} of ${pages}` : undefined} />}
                >
                    <thead>
                        <tr>
                            <th className={cx(TH, 'tw-w-20')}>#</th>
                            <th className={TH}>Skill</th>
                        </tr>
                    </thead>
                    <tbody>
                        {skillList.length > 0 ? skillList.map((skill, index) => (
                            <tr key={skill.idSkills ?? index} className={TR}>
                                <td className={cx(TD, 'tw-tabular-nums tw-text-slate-400')}>{skill.idSkills}</td>
                                <td className={cx(TD, 'tw-font-medium tw-text-slate-900')}>{skill.skillName}</td>
                            </tr>
                        )) : (
                            <EmptyRow colSpan={2} title="No skills match" />
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
