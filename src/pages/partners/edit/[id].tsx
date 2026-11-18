import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { API_URL } from '@/config/public';
import MainLayout from '@/layouts/MainLayout';
import Swal from 'sweetalert2';
import { getCookie } from '@/utils/GetCookie';
import { useRouter } from 'next/router';
import { getRequestOptions } from "@/utils/Fetch";
import { S3_URL } from '@/config/public';
import { ArrowLeft, ImageOff, Loader2, Trash2 } from 'lucide-react';
import { Avatar, Card, SafeImg, Skeleton } from '@/ui/primitives';
import { Button, Field, FileInput, Input, Textarea } from '@/ui/controls';
import { FormSection, LocalPreview } from '@/components/projects/ProjectFormParts';
import { PartnerProfileSections } from '@/components/partners/PartnerFormParts';

interface FormDataType {
    name: string,
    phoneNumber: number,
    age: number,
    location: string,
    role: string,
    bio: string,
    interestedIn: string,
    joiningDate: string,
    multiSkills?: any[],
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
    primary_goal: string,
    // Bangla counterparts for the public partner profile — all optional.
    // A blank field falls back to its English counterpart at render time.
    fullNameBn: string,
    roleBn: string,
    bioBn: string,
    skillsBn: string,
    locationBn: string,
    interestedInBn: string,
    educationBn: string,
    livelihood_activity_bn: string,
    primary_goal_bn: string
}

interface Skills {
    value: number;
    label: string;
}

function PartnerEdit() {
    const router = useRouter();
    const { id } = router.query;
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
        profilePicture: null,
        featuredImages: [],
        disability: 'no',
        partnerType: 'none',
        gender: 'Male',
        household_size: '',
        dependents_size: '',
        livelihood_activity: '',
        primary_goal: '',
        fullNameBn: '',
        roleBn: '',
        bioBn: '',
        skillsBn: '',
        locationBn: '',
        interestedInBn: '',
        educationBn: '',
        livelihood_activity_bn: '',
        primary_goal_bn: ''
    });
    const profilePicRef = useRef<HTMLInputElement>(null);
    const featuredImagesRef = useRef<HTMLInputElement>(null);
    const [skills, setSkills] = useState<Skills[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [loaded, setLoaded] = useState<boolean>(false);

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

    useEffect(() => {
        const fetchPartnerInfo = async () => {
            try {
                const res = await fetch(API_URL + 'api/partners/edit-info/' + id, getRequestOptions());
                const data = await res.json();
                if (res.status === 200) {
                    const partnerData = data.data;
                    setFormData({
                        name: partnerData.fullName,
                        phoneNumber: partnerData.phoneNumber,
                        age: partnerData.age,
                        location: partnerData.location,
                        role: partnerData.role,
                        bio: partnerData.bio,
                        interestedIn: partnerData.interestedIn,
                        joiningDate: partnerData.joiningDate,
                        multiSkills: partnerData.multiSkills.map((item: any) => ({ value: item.idSkills, label: item.skillName })),
                        education: partnerData.education,
                        skills: partnerData.skills,
                        profilePicture: partnerData.ProfilePicture,
                        featuredImages: partnerData.FeaturedImages,
                        disability: partnerData.disability,
                        partnerType: partnerData.partnerType,
                        gender: partnerData.PartnerAdditionalInfo?.gender || 'Male',
                        household_size: partnerData.PartnerAdditionalInfo?.household_size || '',
                        dependents_size: partnerData.PartnerAdditionalInfo?.dependents_size || '',
                        livelihood_activity: partnerData.PartnerAdditionalInfo?.livelihood_activity || '',
                        primary_goal: partnerData.PartnerAdditionalInfo?.primary_goal || '',
                        fullNameBn: partnerData.fullNameBn || '',
                        roleBn: partnerData.roleBn || '',
                        bioBn: partnerData.bioBn || '',
                        skillsBn: partnerData.skillsBn || '',
                        locationBn: partnerData.locationBn || '',
                        interestedInBn: partnerData.interestedInBn || '',
                        educationBn: partnerData.educationBn || '',
                        livelihood_activity_bn: partnerData.PartnerAdditionalInfo?.livelihood_activity_bn || '',
                        primary_goal_bn: partnerData.PartnerAdditionalInfo?.primary_goal_bn || ''
                    });
                    setLoaded(true);
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
        if (id) {
            fetchPartnerInfo();
        }
    }, [id]);

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
            const newFilesArray = Array.from(files);

            for (let i = 0; i < newFilesArray.length; i++) {
                const fileType = newFilesArray[i].type;
                if (!validImageTypes.includes(fileType)) {
                    invalidFiles.push(newFilesArray[i].name);
                }
            }

            if (invalidFiles.length > 0) {
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: `Invalid file type. The following files are not jpeg, jpg, or png images: ${invalidFiles.join(', ')}`,
                });
            } else {
                setFormData(prevFormData => ({
                    ...prevFormData,
                    featuredImages: prevFormData.featuredImages
                        ? [...prevFormData.featuredImages, ...newFilesArray]
                        : newFilesArray
                }));
            }
        }
    }

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);

        Swal.fire({
            title: 'Are you sure?',
            text: "You want to update this partner!",
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
                newFormData.append('partnerType', formData.partnerType);
                newFormData.append('gender', formData.gender);
                newFormData.append('household_size', formData.household_size);
                newFormData.append('dependents_size', formData.dependents_size);
                newFormData.append('livelihood_activity', formData.livelihood_activity);
                newFormData.append('primary_goal', formData.primary_goal);
                // Bangla counterparts — sent as empty strings when untranslated;
                // the API stores null and the site falls back to English.
                newFormData.append('fullNameBn', formData.fullNameBn || '');
                newFormData.append('roleBn', formData.roleBn || '');
                newFormData.append('bioBn', formData.bioBn || '');
                newFormData.append('skillsBn', formData.skillsBn || '');
                newFormData.append('locationBn', formData.locationBn || '');
                newFormData.append('interestedInBn', formData.interestedInBn || '');
                newFormData.append('educationBn', formData.educationBn || '');
                newFormData.append('livelihood_activity_bn', formData.livelihood_activity_bn || '');
                newFormData.append('primary_goal_bn', formData.primary_goal_bn || '');

                if (formData.featuredImages) {
                    for (let i = 0; i < formData.featuredImages.length; i++) {
                        if (formData.featuredImages[i] instanceof File) {
                            newFormData.append('featuredImages', formData.featuredImages[i]);
                        }
                        else {
                            newFormData.append('prevFeaturedImages', formData.featuredImages[i].idFiles);
                        }
                    }
                }
                if (formData.profilePicture instanceof File) {
                    newFormData.append('profilePicture', formData.profilePicture);
                }

                try {
                    const res = await fetch(API_URL + 'api/partners/update/' + id, {
                        method: 'POST',
                        headers: { 'Authorization': 'Bearer ' + getCookie('saathi-token') },
                        body: newFormData,
                    });

                    if (res.status === 200) {
                        Swal.fire({
                            icon: 'success',
                            title: 'Success',
                            text: 'Partner successfully updated!',
                        });
                        router.push('/partners/details/' + id);
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

    const removeFeaturedImage = (index: number) => {
        setFormData(prevFormData => ({
            ...prevFormData,
            featuredImages: prevFormData.featuredImages?.filter((img: any, i: number) => i !== index)
        }));
    };

    const featured: any[] = formData.featuredImages ?? [];
    const existingPicture = formData.profilePicture && formData.profilePicture.idFiles !== undefined ? formData.profilePicture : null;

    return (
        <div className="ui">
            <Link href={`/partners/details/${id ?? ''}`} className="tw-mb-3 tw-inline-flex tw-items-center tw-gap-1.5 tw-text-sm tw-font-medium tw-text-slate-500 hover:tw-text-slate-900">
                <ArrowLeft className="tw-h-4 tw-w-4" aria-hidden /> Back to partner
            </Link>
            <div className="tw-mb-6">
                <p className="tw-text-xs tw-font-semibold tw-uppercase tw-tracking-[0.14em] tw-text-brand-700">Edit partner{id ? ` #${id}` : ''}</p>
                {loaded ? (
                    <h1 className="tw-mt-1 tw-text-[26px] tw-font-semibold tw-leading-8 tw-tracking-tight tw-text-slate-900">{formData.name || 'Unnamed partner'}</h1>
                ) : (
                    <Skeleton className="tw-mt-2 tw-h-7 tw-w-56" />
                )}
            </div>

            <form onSubmit={handleSubmit} className="tw-grid tw-grid-cols-1 tw-items-start tw-gap-6 xl:tw-grid-cols-[minmax(0,1fr)_19rem]">
                <div className="tw-min-w-0 tw-space-y-6">
                    <PartnerProfileSections
                        formData={formData}
                        onChange={handleOnChange}
                        patch={(fields) => setFormData({ ...formData, ...(fields as Partial<FormDataType>) })}
                        skills={skills}
                        onSkillsChange={handleSkillsChange}
                    />

                    {/*
                      Bangla profile copy, grouped in its own section rather than
                      interleaved with the English fields. The partner profile is
                      mirrored on the public website in Bangla, and translation
                      happens as a separate pass after the English record exists —
                      so these all stay optional, and every blank field falls back
                      to its English counterpart at render time.

                      Contact, identity and verification fields are deliberately
                      absent: they are data, not copy, and are not translated.
                    */}
                    <FormSection title="বাংলা / Bangla" description="Every field here is optional. Anything left blank falls back to the English value, so a partly translated profile still renders.">
                        <div className="tw-grid tw-grid-cols-1 tw-gap-4 sm:tw-grid-cols-2">
                            <Field label="Full name (বাংলা)">
                                <Input type="text" lang="bn" placeholder="পুরো নাম" name="fullNameBn" onChange={handleOnChange} value={formData.fullNameBn} />
                            </Field>
                            <Field label="Role (বাংলা)">
                                <Input type="text" lang="bn" placeholder="ভূমিকা" name="roleBn" onChange={handleOnChange} value={formData.roleBn} />
                            </Field>
                            <Field label="Location (বাংলা)">
                                <Input type="text" lang="bn" placeholder="অবস্থান" name="locationBn" onChange={handleOnChange} value={formData.locationBn} />
                            </Field>
                            <Field label="Education (বাংলা)">
                                <Input type="text" lang="bn" placeholder="সর্বশেষ ডিগ্রি" name="educationBn" onChange={handleOnChange} value={formData.educationBn} />
                            </Field>
                            <Field label="Skills (বাংলা)" hint="Comma-separated, matching the English skills list.">
                                <Input type="text" lang="bn" placeholder="দক্ষতা — কমা দিয়ে আলাদা করুন" name="skillsBn" onChange={handleOnChange} value={formData.skillsBn} />
                            </Field>
                            <Field label="Interested in (বাংলা)">
                                <Input type="text" lang="bn" placeholder="আগ্রহের বিষয়" name="interestedInBn" onChange={handleOnChange} value={formData.interestedInBn} />
                            </Field>
                            <Field label="Livelihood activity (বাংলা)">
                                <Input type="text" lang="bn" placeholder="জীবিকার কাজ" name="livelihood_activity_bn" onChange={handleOnChange} value={formData.livelihood_activity_bn} />
                            </Field>
                            <Field label="Primary goal (বাংলা)">
                                <Input type="text" lang="bn" placeholder="প্রধান লক্ষ্য" name="primary_goal_bn" onChange={handleOnChange} value={formData.primary_goal_bn} />
                            </Field>
                            <Field label="Bio (বাংলা)" className="sm:tw-col-span-2">
                                <Textarea rows={5} lang="bn" placeholder="সংক্ষিপ্ত পরিচিতি" name="bioBn" onChange={handleOnChange} value={formData.bioBn} />
                            </Field>
                        </div>
                    </FormSection>

                    <FormSection title="Images" description="JPEG or PNG. New featured images are added to the existing ones.">
                        <div className="tw-grid tw-grid-cols-1 tw-gap-6 md:tw-grid-cols-[12rem_minmax(0,1fr)]">
                            <div>
                                <p className="tw-mb-1.5 tw-text-xs tw-font-medium tw-text-slate-600">Profile picture</p>
                                {formData.profilePicture instanceof File ? (
                                    <LocalPreview file={formData.profilePicture} className="tw-h-40 tw-w-40 tw-rounded-2xl tw-object-cover tw-ring-1 tw-ring-slate-200" />
                                ) : (
                                    <SafeImg
                                        src={existingPicture ? `${S3_URL}profile-picture/${id}/${existingPicture.fileName}` : null}
                                        alt={existingPicture?.originalFileName}
                                        className="tw-h-40 tw-w-40 tw-rounded-2xl tw-object-cover tw-ring-1 tw-ring-slate-200"
                                        fallback={
                                            <span className="tw-flex tw-h-40 tw-w-40 tw-items-center tw-justify-center tw-rounded-2xl tw-bg-slate-50 tw-ring-1 tw-ring-slate-200">
                                                <Avatar name={formData.name || '?'} seed={Number(id) || 0} size="lg" />
                                            </span>
                                        }
                                    />
                                )}
                                <FileInput className="tw-mt-3" accept="image/jpeg,image/png" onChange={handleFileUpload} ref={profilePicRef} aria-label="Replace the profile picture" />
                            </div>
                            <div className="tw-min-w-0">
                                <p className="tw-mb-1.5 tw-text-xs tw-font-medium tw-text-slate-600">Featured images</p>
                                {featured.length === 0 ? (
                                    <p className="tw-rounded-xl tw-border tw-border-dashed tw-border-slate-200 tw-px-4 tw-py-6 tw-text-center tw-text-sm tw-text-slate-400">No featured images</p>
                                ) : (
                                    <ul className="tw-grid tw-grid-cols-2 tw-gap-3 sm:tw-grid-cols-3">
                                        {featured.map((image: any, index: number) => {
                                            const isNew = image instanceof File;
                                            const name = isNew ? image.name : image.originalFileName;
                                            return (
                                                <li key={isNew ? `new-${index}-${image.name}` : image.idFiles} className="tw-overflow-hidden tw-rounded-xl tw-border tw-border-slate-200">
                                                    {isNew ? (
                                                        <LocalPreview file={image} className="tw-aspect-[4/3] tw-w-full tw-object-cover" />
                                                    ) : (
                                                        <a href={`${S3_URL}featured-image/${id}/${image.fileName}`} target="_blank" rel="noopener noreferrer" className="tw-block">
                                                            <SafeImg
                                                                src={`${S3_URL}featured-image/${id}/${image.fileName}`}
                                                                alt={image.originalFileName}
                                                                className="tw-aspect-[4/3] tw-w-full tw-object-cover"
                                                                fallback={
                                                                    <span className="tw-flex tw-aspect-[4/3] tw-w-full tw-items-center tw-justify-center tw-bg-slate-50 tw-text-slate-300">
                                                                        <ImageOff className="tw-h-5 tw-w-5" aria-hidden />
                                                                    </span>
                                                                }
                                                            />
                                                        </a>
                                                    )}
                                                    <div className="tw-flex tw-items-center tw-gap-2 tw-border-t tw-border-slate-200 tw-bg-white tw-px-2.5 tw-py-1.5">
                                                        <span className="tw-min-w-0 tw-flex-1 tw-truncate tw-text-xs tw-text-slate-600" title={name}>{name}</span>
                                                        {isNew && <span className="tw-rounded tw-bg-sky-50 tw-px-1.5 tw-text-[10px] tw-font-semibold tw-text-sky-700">NEW</span>}
                                                        <button
                                                            type="button"
                                                            onClick={() => removeFeaturedImage(index)}
                                                            className="tw-rounded-md tw-p-1 tw-text-slate-400 hover:tw-bg-rose-50 hover:tw-text-rose-600"
                                                            aria-label={`Remove ${name}`}
                                                        >
                                                            <Trash2 className="tw-h-3.5 tw-w-3.5" aria-hidden />
                                                        </button>
                                                    </div>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                )}
                                <FileInput className="tw-mt-3" accept="image/jpeg,image/png" multiple onChange={handleFeatureImageUpload} ref={featuredImagesRef} aria-label="Add featured images" />
                            </div>
                        </div>
                    </FormSection>
                </div>

                <aside className="xl:tw-sticky xl:tw-top-24">
                    <Card className="tw-p-5">
                        <h2 className="tw-text-sm tw-font-semibold tw-text-slate-900">Save changes</h2>
                        <p className="tw-mt-1 tw-text-xs tw-text-slate-500">Removed images are dropped when you save; new ones are uploaded.</p>
                        {/* Disabled until the partner has loaded: saving the empty form would blank the record. */}
                        <Button variant="primary" type="submit" className="tw-mt-4 tw-w-full" disabled={loading || !loaded}>
                            {loading && <Loader2 className="tw-h-4 tw-w-4 tw-animate-spin" aria-hidden />}
                            {loading ? 'Saving…' : 'Save partner'}
                        </Button>
                        <Link href={`/partners/details/${id ?? ''}`} className="tw-mt-2 tw-block tw-text-center tw-text-xs tw-font-medium tw-text-slate-500 hover:tw-text-slate-800">
                            Cancel
                        </Link>
                    </Card>
                </aside>
            </form>
        </div>
    );
}

export default PartnerEdit;

PartnerEdit.getLayout = function PageLayout(page: any) {
    return (
        <MainLayout>
            {page}
        </MainLayout>
    )
}
