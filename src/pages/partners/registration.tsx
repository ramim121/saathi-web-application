import React, { useState, useRef, useEffect } from 'react';
import { API_URL } from '@/config/public';
import MainLayout from '@/layouts/MainLayout';
import Swal from 'sweetalert2';
import { getCookie } from '@/utils/GetCookie';
import { getRequestOptions, postRequestOptions } from '@/utils/Fetch';
import { UnitsPicker, readPicked, type PickItem, type Picked } from '@/components/projects/UnitsPicker';
import { isOpenProject, type ProjectCapacity } from '@/utils/partnerCapacityShared';
import { useRouter } from 'next/router';
import { Check, Circle, Loader2 } from 'lucide-react';
import { Card, cx } from '@/ui/primitives';
import { Button, Field, FileInput } from '@/ui/controls';
import { PageHeader } from '@/ui/layout';
import { FormSection, LocalPreview } from '@/components/projects/ProjectFormParts';
import { DEFAULT_PARTNER_GENDER, PartnerProfileSections } from '@/components/partners/PartnerFormParts';

interface FormDataType {
    name: string,
    phoneNumber: number,
    age: number,
    location: string,
    role: string,
    bio: string,
    interestedIn: string,
    joiningDate: string,
    multiSkills: any[],
    education: string,
    skills: string,
    profilePicture: any,
    featuredImages: any,
    disability: string,
    partnerType: string,
    gender: 'Male' | 'Female' | 'Other',
    household_size: string,
    dependents_size: string,
    livelihood_activity: string,
    primary_goal: string
}

interface Skills {
    value: number;
    label: string;
}

function Registration() {
    const router = useRouter();
    const [projectOptions, setProjectOptions] = useState<PickItem[]>([]);
    const [pickedProjects, setPickedProjects] = useState<Picked>({});

    useEffect(() => {
        fetch('/api/assignments', getRequestOptions())
            .then((r) => r.json())
            .then((body) => {
                const open = ((body?.data?.projects ?? []) as ProjectCapacity[]).filter((p) => isOpenProject(p.projectStatus));
                setProjectOptions(open.map((p) => ({ id: p.idProjects, title: p.projectName, subtitle: `${p.duration} ${p.tenure} · ${p.partners} partner(s) · ${p.left === null ? 'no limit' : `${p.left} units left`}` })));
            })
            .catch(() => setProjectOptions([]));
    }, []);

    const [formData, setFormData] = useState<FormDataType>({
        name: '',
        phoneNumber: 0,
        age: 0,
        location: '',
        role: '',
        bio: '',
        interestedIn: '',
        joiningDate: '',
        multiSkills: [],
        education: '',
        skills: '',
        profilePicture: '',
        featuredImages: '',
        disability: 'no',
        partnerType: 'none',
        gender: DEFAULT_PARTNER_GENDER,
        household_size: '',
        dependents_size: '',
        livelihood_activity: '',
        primary_goal: ''
    });
    const profilePicRef = useRef<HTMLInputElement>(null);
    const featuredImagesRef = useRef<HTMLInputElement>(null);
    const [skills, setSkills] = useState<Skills[]>([]);
    const [loading, setLoading] = useState<boolean>(false);

    useEffect(() => {
        const fetchSkills = async () => {
            try {
                const res = await fetch(API_URL + 'api/all_skills');
                const data = await res.json();
                if (res.status === 200) {
                    setSkills(data.data);
                } else {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: data.message,
                    });
                }
            } catch (err) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Something went wrong!',
                });
            }
        };
        fetchSkills();
    }, []);

    const handleOnChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSkillsChange = (selectedOption: any) => {
        setFormData({
            ...formData,
            multiSkills: selectedOption,
            skills: selectedOption.map((item: any) => item.label).join(','),
        });
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const fileType = file.type;
            const validImageTypes = ['image/jpeg', 'image/png', 'image/jpg'];
            if (validImageTypes.includes(fileType)) {
                setFormData({ ...formData, profilePicture: file });
            } else {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Invalid file type. Please upload a jpeg, jpg, or png image.',
                });
            }
        }
    }

    const handleFeatureImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (files) {
            const validImageTypes = ['image/jpeg', 'image/png', 'image/jpg'];
            const invalidFiles = [];

            for (let i = 0; i < files.length; i++) {
                const fileType = files[i].type;
                if (!validImageTypes.includes(fileType)) {
                    invalidFiles.push(files[i].name);
                }
            }

            if (invalidFiles.length > 0) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: `Invalid file type. The following files are not jpeg, jpg, or png images: ${invalidFiles.join(', ')}`,
                });
            } else {
                setFormData({ ...formData, featuredImages: files });
            }
        }
    }

    const canHoldProjects = formData.partnerType === 'project' || formData.partnerType === 'both';

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        // Only project partners can hold projects; a type changed back drops the ticks.
        const chosen = canHoldProjects ? readPicked(pickedProjects) : { rows: [], problem: null };
        if (chosen.problem) {
            Swal.fire({ icon: 'warning', title: chosen.problem });
            return;
        }
        // Set loading to true before the Swal confirmation
        setLoading(true);

        Swal.fire({
            title: 'Are you sure?',
            text: "You want to register this partner!",
            icon: 'warning',
            showCancelButton: true,
            cancelButtonText: 'No',
            confirmButtonText: 'Yes'
        }).then(async (result) => {
            if (result.value) {
                const newFormData = new FormData();
                newFormData.append('name', formData.name);
                newFormData.append('phoneNumber', formData.phoneNumber.toString());
                newFormData.append('age', formData.age.toString());
                newFormData.append('location', formData.location);
                newFormData.append('role', formData.role);
                newFormData.append('bio', formData.bio);
                newFormData.append('interestedIn', formData.interestedIn);
                newFormData.append('joiningDate', formData.joiningDate);
                newFormData.append('skills', formData.skills);
                newFormData.append('education', formData.education);
                newFormData.append('disability', formData.disability);
                newFormData.append('profilePicture', formData.profilePicture);
                newFormData.append('partnerType', formData.partnerType);
                newFormData.append('gender', formData.gender);
                newFormData.append('household_size', formData.household_size);
                newFormData.append('dependents_size', formData.dependents_size);
                newFormData.append('livelihood_activity', formData.livelihood_activity);
                newFormData.append('primary_goal', formData.primary_goal);

                if (formData.featuredImages) {
                    for (let i = 0; i < formData.featuredImages.length; i++) {
                        newFormData.append('featuredImages', formData.featuredImages[i]);
                    }
                }

                try {
                    const res = await fetch(API_URL + 'api/partners/registration', {
                        method: 'POST',
                        headers: { 'Authorization': 'Bearer ' + getCookie('saathi-token') },
                        body: newFormData,
                    });

                    if (res.status === 200) {
                        const idUsers = (await res.json()).data.idUsers;
                        // The partner exists from here on: a failed assignment must not read as a failed registration.
                        if (chosen.rows.length) {
                            const assign = await fetch(API_URL + 'api/assignments', postRequestOptions({ pairs: chosen.rows.map((r) => ({ idProjects: r.id, idUsers, capacity: r.units })) }));
                            if (!assign.ok) {
                                const problem = (await assign.json()).message;
                                await Swal.fire({ icon: 'warning', title: 'Partner registered, projects not added', html: problem });
                                router.push(`/projects/partner_assign?partner=${idUsers}`);
                                return;
                            }
                        }
                        Swal.fire({
                            icon: 'success',
                            title: 'Success',
                            text: chosen.rows.length ? `Partner registered and added to ${chosen.rows.length} project(s).` : 'Partner successfully registered!',
                        });
                        router.push('/partners/details/' + idUsers);
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

    const checklist: [string, boolean][] = [
        ['Name and phone', Boolean(formData.name && formData.phoneNumber)],
        ['Age and role', Boolean(Number(formData.age) > 0 && formData.role)],
        ['Joining date', Boolean(formData.joiningDate)],
        ['Location', Boolean(formData.location)],
        ['Skills', Boolean(formData.skills)],
    ];
    const featuredFiles: File[] = formData.featuredImages ? Array.from(formData.featuredImages as FileList) : [];

    return (
        <div className="ui">
            <PageHeader
                eyebrow="People"
                title="Register partner"
                description="Add a farmer or producer Shathi works with, and put them on projects in the same step."
            />

            <form onSubmit={handleSubmit} className="tw-grid tw-grid-cols-1 tw-items-start tw-gap-6 xl:tw-grid-cols-[minmax(0,1fr)_19rem]">
                <div className="tw-min-w-0 tw-space-y-6">
                    <PartnerProfileSections
                        formData={formData}
                        onChange={handleOnChange}
                        patch={(fields) => setFormData({ ...formData, ...(fields as Partial<FormDataType>) })}
                        skills={skills}
                        onSkillsChange={handleSkillsChange}
                    />

                    <FormSection title="Images" description="JPEG or PNG.">
                        <div className="tw-grid tw-grid-cols-1 tw-gap-5 sm:tw-grid-cols-2">
                            <div>
                                <Field label="Profile picture">
                                    <FileInput accept="image/jpeg,image/png" onChange={handleFileUpload} ref={profilePicRef} />
                                </Field>
                                {formData.profilePicture instanceof File && (
                                    <LocalPreview file={formData.profilePicture} className="tw-mt-3 tw-h-28 tw-w-28 tw-rounded-2xl tw-object-cover tw-ring-1 tw-ring-slate-200" />
                                )}
                            </div>
                            <div>
                                <Field label="Featured images" hint="Choosing again replaces the selection.">
                                    <FileInput accept="image/jpeg,image/png" multiple onChange={handleFeatureImageUpload} ref={featuredImagesRef} />
                                </Field>
                                {featuredFiles.length > 0 && (
                                    <ul className="tw-mt-3 tw-grid tw-grid-cols-3 tw-gap-2">
                                        {featuredFiles.map((file, index) => (
                                            <li key={index}>
                                                <LocalPreview file={file} className="tw-aspect-square tw-w-full tw-rounded-lg tw-object-cover tw-ring-1 tw-ring-slate-200" />
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    </FormSection>

                    <FormSection title="Projects" description="Optional. Tick the projects this partner joins and how many units they can hold on each.">
                        {canHoldProjects ? (
                            <UnitsPicker items={projectOptions} picked={pickedProjects} onChange={setPickedProjects} noun="projects" emptyText="No open projects." maxHeight="tw-max-h-64" />
                        ) : (
                            <div className="tw-flex tw-flex-wrap tw-items-center tw-justify-between tw-gap-3 tw-rounded-xl tw-bg-slate-50 tw-px-4 tw-py-3">
                                <p className="tw-text-sm tw-text-slate-600">Only a project partner can be put on projects. This partner&apos;s type is set to {formData.partnerType === 'product' ? 'Product' : 'None'}.</p>
                                <Button size="sm" onClick={() => setFormData({ ...formData, partnerType: formData.partnerType === 'product' ? 'both' : 'project' })}>
                                    Make them a project partner
                                </Button>
                            </div>
                        )}
                    </FormSection>
                </div>

                <aside className="xl:tw-sticky xl:tw-top-24">
                    <Card className="tw-p-5">
                        <h2 className="tw-text-sm tw-font-semibold tw-text-slate-900">Before you register</h2>
                        <ul className="tw-mt-3 tw-space-y-2">
                            {checklist.map(([label, done]) => (
                                <li key={label} className={cx('tw-flex tw-items-center tw-gap-2 tw-text-sm', done ? 'tw-text-slate-700' : 'tw-text-slate-400')}>
                                    {done ? <Check className="tw-h-4 tw-w-4 tw-text-emerald-600" aria-hidden /> : <Circle className="tw-h-4 tw-w-4" aria-hidden />}
                                    {label}
                                </li>
                            ))}
                        </ul>
                        <Button variant="primary" type="submit" className="tw-mt-5 tw-w-full" disabled={loading}>
                            {loading && <Loader2 className="tw-h-4 tw-w-4 tw-animate-spin" aria-hidden />}
                            {loading ? 'Registering…' : 'Register partner'}
                        </Button>
                    </Card>
                </aside>
            </form>
        </div>
    );
}

export default Registration;

Registration.getLayout = function PageLayout(page: any) {
    return (
        <MainLayout>
            {page}
        </MainLayout>
    )
}
