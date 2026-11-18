import React, { useState } from 'react';
import { API_URL } from '@/config/public';
import MainLayout from '@/layouts/MainLayout';
import Swal from 'sweetalert2';
import { postRequestOptions } from '@/utils/Fetch';
import { KeyRound, ShieldCheck, ShieldPlus } from 'lucide-react';
import { Card } from '@/ui/primitives';
import { Button, Field, Input, Required } from '@/ui/controls';
import { PageHeader } from '@/ui/layout';

interface FormDataType {
    name: string,
    email: string,
    phoneNumber: string
}

function Registration() {
    // The old number field started at '0' so the leading zero survived; a phone
    // field keeps it, so it starts empty and typing the full 01… number works.
    const [formData, setFormData] = useState<FormDataType>({
        name: '',
        email: '',
        phoneNumber: ''
    });

    const handleOnChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    }

    // Digits only, as the number field this replaces allowed.
    const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, phoneNumber: e.target.value.replace(/\D/g, '') });
    }

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        Swal.fire({
            title: 'Are you sure?',
            text: "You want to register!",
            icon: 'warning',
            showCancelButton: true,
            cancelButtonText: 'No',
            confirmButtonText: 'Yes',
            showLoaderOnConfirm: true,
            allowOutsideClick: false,
            allowEscapeKey: false,
            preConfirm: async () => {
                try {
                    const res = await fetch(API_URL + 'api/admin_registration', postRequestOptions(formData));
                    if (res.status === 200) {
                        Swal.fire({
                            icon: 'success',
                            title: 'Success',
                            text: 'Admin registration successful!',
                        });
                        setFormData({
                            name: '',
                            email: '',
                            phoneNumber: '',
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
                        text: (err instanceof Error ? err.message : 'Something went wrong!'),
                    });
                }
            }
        });
    };


    return (
        <div className="ui">
            <PageHeader eyebrow="Admin" title="Add an admin" description="Creates an account with admin rights on this panel." />
            <div className="tw-grid tw-grid-cols-1 tw-items-start tw-gap-6 lg:tw-grid-cols-[minmax(0,30rem)_minmax(0,22rem)]">
                <Card className="tw-p-6">
                    <form onSubmit={handleSubmit} className="tw-space-y-4">
                        <Field label={<>Full name<Required /></>}>
                            <Input type="text" placeholder="Their full name" name="name" autoComplete="off" onChange={handleOnChange} value={formData.name} />
                        </Field>
                        <Field label={<>Email<Required /></>}>
                            <Input type="email" placeholder="name@digigramventures.com" name="email" autoComplete="off" onChange={handleOnChange} value={formData.email} />
                        </Field>
                        <Field label={<>Phone number<Required /></>} hint="11 digits, starting with 01.">
                            <Input type="tel" inputMode="numeric" placeholder="01XXXXXXXXX" name="phoneNumber" autoComplete="off" onChange={handlePhoneChange} value={formData.phoneNumber} />
                        </Field>
                        <div className="tw-flex tw-justify-end tw-pt-1">
                            <Button variant="primary" type="submit">
                                <ShieldPlus className="tw-h-4 tw-w-4" aria-hidden />
                                Add admin
                            </Button>
                        </div>
                    </form>
                </Card>

                <Card className="tw-space-y-4 tw-p-5 tw-text-sm tw-leading-6 tw-text-slate-600">
                    <div className="tw-flex tw-gap-3">
                        <ShieldCheck className="tw-mt-0.5 tw-h-4 tw-w-4 tw-shrink-0 tw-text-brand-700" aria-hidden />
                        <p>Admins have the same full access you do: every booking, investor, partner and project.</p>
                    </div>
                    <div className="tw-flex tw-gap-3">
                        <KeyRound className="tw-mt-0.5 tw-h-4 tw-w-4 tw-shrink-0 tw-text-amber-600" aria-hidden />
                        <p>
                            <strong className="tw-font-semibold tw-text-slate-900">No password is set here.</strong> Signing in to this panel needs an email and a password, so the new
                            account can&apos;t sign in until a password is added to it.
                        </p>
                    </div>
                </Card>
            </div>
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
