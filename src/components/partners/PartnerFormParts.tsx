import type { ChangeEvent } from 'react';
import ReactSelect from 'react-select';
import { Segmented } from '@/ui/primitives';
import { Field, Input, Required, Textarea } from '@/ui/controls';
import { selectStyles } from '@/ui/select';
import { FormSection } from '@/components/projects/ProjectFormParts';

/**
 * The partner profile fields Register partner and Edit partner share. Each
 * page keeps its own state, payload and submit handler; this only renders.
 */

export interface PartnerCommonFields {
    name: string;
    phoneNumber: number | string;
    age: number | string;
    location: string;
    role: string;
    bio: string;
    interestedIn: string;
    joiningDate: string;
    multiSkills?: any[];
    education: string;
    skills: string;
    disability: string;
    partnerType: string;
    gender: 'Male' | 'Female' | 'Other';
    household_size: string;
    dependents_size: string;
    livelihood_activity: string;
    primary_goal: string;
}

export type SkillOption = { value: number; label: string };

type Props = {
    formData: PartnerCommonFields;
    onChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
    patch: (fields: Partial<PartnerCommonFields>) => void;
    skills: SkillOption[];
    onSkillsChange: (selected: any) => void;
};

/**
 * Preselected gender for a new partner, or one with none recorded. Shathi's
 * partners are rural women farmers: production had 42 women and 11 men among
 * its 53 individual partners on 2026-11-18. The old default, Male, recorded
 * the wrong value whenever nobody changed it.
 */
export const DEFAULT_PARTNER_GENDER = 'Female' as const;

export const PARTNER_TYPES = [
    { value: 'none', label: 'None' },
    { value: 'project', label: 'Project' },
    { value: 'product', label: 'Product' },
    { value: 'both', label: 'Both' },
] as const;

export function PartnerProfileSections({ formData, onChange, patch, skills, onSkillsChange }: Props) {
    return (
        <>
            <FormSection title="Profile" description="Shown on the partner's public profile in the app and on the website, except the phone number.">
                <div className="tw-grid tw-grid-cols-1 tw-gap-4 sm:tw-grid-cols-2">
                    <Field label={<>Full name<Required /></>}>
                        <Input type="text" placeholder="Full name" name="name" onChange={onChange} value={formData.name ?? ''} />
                    </Field>
                    <Field label={<>Phone number<Required /></>}>
                        {/* Text, not a number field: a number field drops the leading 0 of 01… */}
                        <Input type="tel" inputMode="numeric" placeholder="01XXXXXXXXX" name="phoneNumber" onChange={onChange} value={formData.phoneNumber || ''} />
                    </Field>
                    <Field label={<>Age<Required /></>}>
                        <Input type="number" min={0} placeholder="e.g. 32" name="age" onChange={onChange} value={formData.age || ''} />
                    </Field>
                    <Field label={<>Role<Required /></>}>
                        <Input type="text" placeholder="e.g. Cattle farmer" name="role" onChange={onChange} value={formData.role ?? ''} />
                    </Field>
                    <Field label={<>Joining date<Required /></>}>
                        <Input type="date" name="joiningDate" onChange={onChange} value={formData.joiningDate ?? ''} />
                    </Field>
                    <Field label={<>Location / address<Required /></>}>
                        <Input type="text" placeholder="Village, upazila, district" name="location" onChange={onChange} value={formData.location ?? ''} />
                    </Field>
                    <Field label="Education">
                        <Input type="text" placeholder="Last degree" name="education" onChange={onChange} value={formData.education ?? ''} />
                    </Field>
                    <Field label="Interested in">
                        <Input type="text" placeholder="Kinds of projects" name="interestedIn" onChange={onChange} value={formData.interestedIn ?? ''} />
                    </Field>
                    <Field label="Bio" className="sm:tw-col-span-2">
                        <Textarea placeholder="A few lines about the partner" name="bio" onChange={onChange} value={formData.bio ?? ''} />
                    </Field>
                </div>
            </FormSection>

            <FormSection title="Skills and type">
                <div className="tw-space-y-5">
                    <Field label={<>Skills<Required /></>}>
                        <ReactSelect<SkillOption, true>
                            instanceId="skills"
                            inputId="skills"
                            options={skills}
                            value={formData.multiSkills}
                            onChange={onSkillsChange}
                            isMulti
                            placeholder="Choose skills"
                            styles={selectStyles<SkillOption, true>()}
                        />
                    </Field>
                    <div className="tw-flex tw-flex-wrap tw-gap-x-8 tw-gap-y-4">
                        <div>
                            <p className="tw-mb-1.5 tw-text-xs tw-font-medium tw-text-slate-600">Partner type</p>
                            <Segmented
                                label="Partner type"
                                value={formData.partnerType || 'none'}
                                onChange={(value) => patch({ partnerType: value })}
                                options={PARTNER_TYPES.map((t) => ({ value: t.value as string, label: t.label }))}
                            />
                        </div>
                        <div>
                            <p className="tw-mb-1.5 tw-text-xs tw-font-medium tw-text-slate-600">
                                Gender<Required />
                            </p>
                            <Segmented<'Male' | 'Female' | 'Other'>
                                label="Gender"
                                value={formData.gender || DEFAULT_PARTNER_GENDER}
                                onChange={(value) => patch({ gender: value })}
                                options={[
                                    { value: 'Female', label: 'Female' },
                                    { value: 'Male', label: 'Male' },
                                    { value: 'Other', label: 'Other' },
                                ]}
                            />
                        </div>
                        <div>
                            <p className="tw-mb-1.5 tw-text-xs tw-font-medium tw-text-slate-600">
                                Disability<Required />
                            </p>
                            <Segmented
                                label="Disability"
                                value={formData.disability || 'no'}
                                onChange={(value) => patch({ disability: value })}
                                options={[
                                    { value: 'no', label: 'No' },
                                    { value: 'yes', label: 'Yes' },
                                ]}
                            />
                        </div>
                    </div>
                </div>
            </FormSection>

            <FormSection title="Household" description="Part of the partner's story: the app shows these on the partner's profile.">
                <div className="tw-grid tw-grid-cols-1 tw-gap-4 sm:tw-grid-cols-2">
                    <Field label="Household size">
                        <Input type="text" inputMode="numeric" placeholder="People in the household" name="household_size" onChange={onChange} value={formData.household_size ?? ''} />
                    </Field>
                    <Field label="Dependents">
                        <Input type="text" inputMode="numeric" placeholder="How many depend on them" name="dependents_size" onChange={onChange} value={formData.dependents_size ?? ''} />
                    </Field>
                    <Field label="Livelihood activity" className="sm:tw-col-span-2">
                        <Input type="text" placeholder="Main source of income" name="livelihood_activity" onChange={onChange} value={formData.livelihood_activity ?? ''} />
                    </Field>
                    <Field label="Primary goal" className="sm:tw-col-span-2">
                        <Textarea rows={3} placeholder="What they want to achieve" name="primary_goal" onChange={onChange} value={formData.primary_goal ?? ''} />
                    </Field>
                </div>
            </FormSection>
        </>
    );
}
