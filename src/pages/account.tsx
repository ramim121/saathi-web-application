import React, { useEffect, useState, type ReactNode } from 'react';
import type { GetServerSidePropsContext } from 'next';
import Swal from 'sweetalert2';
import { KeyRound, Loader2, Mail, UserRound } from 'lucide-react';
import MainLayout from '@/layouts/MainLayout';
import { API_URL } from '@/config/public';
import { getRequestOptions, postRequestOptions } from '@/utils/Fetch';
import { requireAdminPage, redirectToLogin } from '@/utils/pageAuth';
import { ADMIN_PASSWORD_MIN } from '@/utils/adminPassword';
import { Card, Skeleton } from '@/ui/primitives';
import { Button, Field, PasswordInput, Required } from '@/ui/controls';
import { PageHeader } from '@/ui/layout';

const EMPTY = { currentPassword: '', newPassword: '', confirm: '' };

/** The signed-in admin's own account: who they are, and changing their password. */
export default function AccountPage() {
    const [me, setMe] = useState<{ fullName?: string | null; email?: string | null } | null>(null);
    const [form, setForm] = useState(EMPTY);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        let live = true;
        fetch('/api/user', getRequestOptions())
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => {
                if (live) setMe(d?.user ? { fullName: d.user.fullName, email: d.user.email } : {});
            })
            .catch(() => live && setMe({}));
        return () => {
            live = false;
        };
    }, []);

    const set = (key: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value });

    const submit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (form.newPassword.length < ADMIN_PASSWORD_MIN) {
            Swal.fire({ icon: 'error', title: 'New password too short', text: `Use at least ${ADMIN_PASSWORD_MIN} characters.` });
            return;
        }
        if (form.newPassword !== form.confirm) {
            Swal.fire({ icon: 'error', title: 'Passwords do not match', text: 'Type the same new password in both fields.' });
            return;
        }
        setSaving(true);
        try {
            const res = await fetch(API_URL + 'api/admin/change-password', postRequestOptions({ currentPassword: form.currentPassword, newPassword: form.newPassword }));
            const data = await res.json();
            if (res.ok) {
                setForm(EMPTY);
                Swal.fire({ icon: 'success', title: 'Password changed', text: 'Use the new password next time you sign in.' });
            } else {
                Swal.fire({ icon: 'error', title: 'Not changed', html: data.message });
            }
        } catch {
            Swal.fire({ icon: 'error', title: 'Error', text: 'Something went wrong. Try again.' });
        } finally {
            setSaving(false);
        }
    };

    const mismatch = form.confirm.length > 0 && form.confirm !== form.newPassword;

    return (
        <div className="ui">
            <PageHeader eyebrow="Settings" title="Your account" description="Your admin sign-in details." />
            <div className="tw-grid tw-grid-cols-1 tw-items-start tw-gap-6 lg:tw-grid-cols-[minmax(0,22rem)_minmax(0,30rem)]">
                <Card className="tw-space-y-3 tw-p-5 tw-text-sm">
                    <h2 className="tw-text-sm tw-font-semibold tw-text-slate-900">Signed in as</h2>
                    {me === null ? (
                        <div className="tw-space-y-2">
                            <Skeleton className="tw-h-4 tw-w-40" />
                            <Skeleton className="tw-h-4 tw-w-56" />
                        </div>
                    ) : (
                        <>
                            <Detail icon={<UserRound className="tw-h-4 tw-w-4" aria-hidden />}>{me.fullName || '—'}</Detail>
                            <Detail icon={<Mail className="tw-h-4 tw-w-4" aria-hidden />}>{me.email || '—'}</Detail>
                        </>
                    )}
                </Card>

                <Card className="tw-p-6">
                    <div className="tw-flex tw-items-center tw-gap-2">
                        <KeyRound className="tw-h-4 tw-w-4 tw-text-brand-700" aria-hidden />
                        <h2 className="tw-text-sm tw-font-semibold tw-text-slate-900">Change password</h2>
                    </div>
                    <form onSubmit={submit} className="tw-mt-4 tw-space-y-4">
                        <Field label={<>Current password<Required /></>}>
                            <PasswordInput name="currentPassword" autoComplete="current-password" value={form.currentPassword} onChange={set('currentPassword')} required />
                        </Field>
                        <Field label={<>New password<Required /></>} hint={`At least ${ADMIN_PASSWORD_MIN} characters, different from the current one.`}>
                            <PasswordInput name="newPassword" autoComplete="new-password" value={form.newPassword} onChange={set('newPassword')} required />
                        </Field>
                        <Field label={<>Confirm new password<Required /></>} hint={mismatch ? <span className="tw-text-rose-600">Does not match yet.</span> : undefined}>
                            <PasswordInput name="confirmPassword" autoComplete="new-password" value={form.confirm} onChange={set('confirm')} required />
                        </Field>
                        <p className="tw-text-xs tw-leading-5 tw-text-slate-500">
                            Devices already signed in stay signed in until they sign out; a sign-in lasts up to 30 days.
                        </p>
                        <div className="tw-flex tw-justify-end">
                            <Button variant="primary" type="submit" disabled={saving}>
                                {saving ? <Loader2 className="tw-h-4 tw-w-4 tw-animate-spin" aria-hidden /> : <KeyRound className="tw-h-4 tw-w-4" aria-hidden />}
                                Change password
                            </Button>
                        </div>
                    </form>
                </Card>
            </div>
        </div>
    );
}

function Detail({ icon, children }: { icon: ReactNode; children: ReactNode }) {
    return (
        <p className="tw-flex tw-items-center tw-gap-2.5 tw-text-slate-700">
            <span className="tw-text-slate-400">{icon}</span>
            <span className="tw-min-w-0 tw-break-words">{children}</span>
        </p>
    );
}

AccountPage.getLayout = function PageLayout(page: ReactNode) {
    return <MainLayout>{page}</MainLayout>;
};

export async function getServerSideProps(context: GetServerSidePropsContext) {
    if (!requireAdminPage(context)) return redirectToLogin;
    return { props: {} };
}
