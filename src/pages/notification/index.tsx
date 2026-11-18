/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useRef, useContext, useEffect } from 'react';
import Link from 'next/link';
import MainLayout from '@/layouts/MainLayout';
import { API_URL } from '@/config/public';
import Swal from 'sweetalert2';
import { getCookie } from '@/utils/GetCookie';
import { AppContext } from '@/context/AppContext';
import { getRequestOptions } from '@/utils/Fetch';
import { BellRing, ChevronRight, Loader2, Mail, MessageSquare, Send, Smartphone, X, type LucideIcon } from 'lucide-react';
import { Card, Pill, Segmented, cx } from '@/ui/primitives';
import { Button, Field, FileInput, Input, Required, Select, Textarea } from '@/ui/controls';
import { EmptyRow, PageHeader, Pager, TableCard, TD, TH, TR } from '@/ui/layout';
import { SummaryEditor } from '@/components/projects/ProjectFormParts';

interface FormDataType {
    createdBy?: number;
    targetUserIds: string;
    sendViaSms: string;
    smsBody: string;
    sendViaEmail: string;
    emailSubject: string;
    emailBody: string;
    sendViaPush: string;
    pushNotificationTitle: string;
    pushNotificationBody: string;
    pushNotificationImage: File | null;
}

interface ListProps {
    idManualNotifications: string,
    sendViaSms: string,
    sendViaEmail: string,
    sendViaPush: string,
    formattedSendOn: string,
    User: {
        fullName: string
    },
}

interface FilterProps {
    idManualNotifications: string,
    sendViaSms: string,
    sendViaEmail: string,
    sendViaPush: string,
    sendOn: string,
    createdBy: string,
    orderBy: string,
    orderType: string,
    page: number,
    pageSize: number
}

const INITIAL_FILTER: FilterProps = {
    idManualNotifications: '',
    sendViaSms: '',
    sendViaEmail: '',
    sendViaPush: '',
    sendOn: '',
    createdBy: '',
    orderBy: 'idManualNotifications',
    orderType: 'DESC',
    page: 1,
    pageSize: 10
};

/** One delivery channel: a yes/no switch, and its fields when switched on. */
function Channel({ icon: Icon, title, on, onToggle, children }: { icon: LucideIcon; title: string; on: boolean; onToggle: (on: boolean) => void; children: React.ReactNode }) {
    return (
        <div className={cx('tw-rounded-2xl tw-border tw-transition', on ? 'tw-border-brand-200 tw-bg-brand-50/30' : 'tw-border-slate-200')}>
            <div className="tw-flex tw-items-center tw-justify-between tw-gap-3 tw-px-4 tw-py-3">
                <span className="tw-flex tw-items-center tw-gap-2 tw-text-sm tw-font-semibold tw-text-slate-900">
                    <Icon className={cx('tw-h-4 tw-w-4', on ? 'tw-text-brand-700' : 'tw-text-slate-400')} aria-hidden /> {title}
                </span>
                <Segmented<'no' | 'yes'>
                    label={`Send via ${title}`}
                    value={on ? 'yes' : 'no'}
                    onChange={(value) => onToggle(value === 'yes')}
                    options={[
                        { value: 'no', label: 'Off' },
                        { value: 'yes', label: 'On' },
                    ]}
                />
            </div>
            {on && <div className="tw-space-y-4 tw-border-t tw-border-slate-100 tw-px-4 tw-py-4">{children}</div>}
        </div>
    );
}

const yesNo = (value: string | null | undefined) =>
    value === 'yes' ? <Pill tone="green" dot={false}>Yes</Pill> : <span className="tw-text-xs tw-text-slate-400">No</span>;

function ManualNotification() {
    const { currentUser } = useContext(AppContext);
    const [formData, setFormData] = useState<FormDataType>({
        targetUserIds: '',
        sendViaSms: 'no',
        smsBody: '',
        sendViaEmail: 'no',
        emailSubject: '',
        emailBody: '',
        sendViaPush: 'no',
        pushNotificationTitle: '',
        pushNotificationBody: '',
        pushNotificationImage: null
    });
    const editorRef = useRef<any>(null);
    const [loading, setLoading] = useState<boolean>(false);

    const handleTextChange = (e: any) => {
        const { name, value } = e.target;
        setFormData({
            ...formData,
            [name]: value
        });
    }

    const setChannel = (name: 'sendViaSms' | 'sendViaEmail' | 'sendViaPush', on: boolean) => {
        // The email editor unmounts when email is switched off; forget it, so a
        // later send reads the stored body rather than a destroyed editor.
        if (name === 'sendViaEmail' && !on) editorRef.current = null;
        setFormData({ ...formData, [name]: on ? 'yes' : 'no' });
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        Swal.fire({
            title: 'Are you sure?',
            text: "You want to create this manual notification!",
            icon: 'warning',
            showCancelButton: true,
            cancelButtonText: 'No',
            confirmButtonText: 'Yes'
        }).then(async (result) => {
            if (result.value) {
                try {
                    formData.createdBy = currentUser?.idUsers || undefined;
                    const newFormData = new FormData();
                    newFormData.append('createdBy', formData.createdBy?.toString() || '');
                    newFormData.append('targetUserIds', formData.targetUserIds);
                    newFormData.append('sendViaSms', formData.sendViaSms);
                    newFormData.append('smsBody', formData.smsBody);
                    newFormData.append('sendViaEmail', formData.sendViaEmail);
                    newFormData.append('emailSubject', formData.emailSubject);
                    if (editorRef.current !== null) {
                        newFormData.append('emailBody', editorRef.current.getContent());
                    } else {
                        newFormData.append('emailBody', formData.emailBody);
                    }
                    newFormData.append('sendViaPush', formData.sendViaPush);
                    newFormData.append('pushNotificationTitle', formData.pushNotificationTitle);
                    newFormData.append('pushNotificationBody', formData.pushNotificationBody);
                    if (formData.pushNotificationImage) {
                        newFormData.append('pushNotificationImage', formData.pushNotificationImage);
                    }

                    const res = await fetch(API_URL + 'api/manual-notification/create', {
                        method: 'POST',
                        headers: { 'Authorization': 'Bearer ' + getCookie('saathi-token') },
                        body: newFormData,
                    });

                    if (res.status === 200) {
                        Swal.fire({
                            icon: 'success',
                            title: 'Success',
                            text: 'Manual notification created successfully!',
                        });
                        fetchManualNotificationList();
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

    const [manualNotificationList, setManualNotificationList] = useState<ListProps[]>([]);
    const [filter, setFilter] = useState<FilterProps>(INITIAL_FILTER);
    const [total, setTotal] = useState<number>(0);
    const [totalPages, setTotalPages] = useState<number>(1);

    const fetchManualNotificationList = async () => {
        const query = new URLSearchParams(filter as any).toString();
        try {
            const res = await fetch(`/api/manual-notification/list?${query}`, getRequestOptions());
            const data = await res.json();
            if (res.status === 200) {
                setManualNotificationList(data.data);
                setTotal(data.total);
                setTotalPages(data.totalPages);
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
        }
    }

    useEffect(() => {
        fetchManualNotificationList();
    }, [filter]);

    // A changed filter starts again from page 1.
    const handleInputOnChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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

    const channels = [formData.sendViaSms === 'yes' && 'SMS', formData.sendViaEmail === 'yes' && 'email', formData.sendViaPush === 'yes' && 'push'].filter(Boolean) as string[];
    const recipients = formData.targetUserIds.split(',').map((s) => s.trim()).filter(Boolean);
    const anyFilter = Boolean(filter.idManualNotifications || filter.sendViaSms || filter.sendViaEmail || filter.sendViaPush || filter.sendOn || filter.createdBy);

    return (
        <div className="ui">
            <PageHeader eyebrow="Content" title="Notifications" description="Send a message to everyone, or to chosen users, by SMS, email or app push." />

            <form onSubmit={handleSubmit} className="tw-grid tw-grid-cols-1 tw-items-start tw-gap-6 xl:tw-grid-cols-[minmax(0,1fr)_19rem]">
                <div className="tw-min-w-0 tw-space-y-4">
                    <Card className="tw-p-5">
                        <Field label="Recipients" hint="Leave blank to send to all users, or enter user IDs separated by commas (e.g. 1,2,3).">
                            <Input type="text" name="targetUserIds" value={formData.targetUserIds} onChange={handleTextChange} placeholder="All users" />
                        </Field>
                    </Card>
                    <Channel icon={MessageSquare} title="SMS" on={formData.sendViaSms === 'yes'} onToggle={(on) => setChannel('sendViaSms', on)}>
                        <Field label={<>Message<Required /></>} hint={`${formData.smsBody.length} characters`}>
                            <Textarea rows={3} name="smsBody" value={formData.smsBody} onChange={handleTextChange} />
                        </Field>
                    </Channel>
                    <Channel icon={Mail} title="Email" on={formData.sendViaEmail === 'yes'} onToggle={(on) => setChannel('sendViaEmail', on)}>
                        <Field label={<>Subject<Required /></>}>
                            <Input type="text" name="emailSubject" value={formData.emailSubject} onChange={handleTextChange} />
                        </Field>
                        <div>
                            <p className="tw-mb-1.5 tw-text-xs tw-font-medium tw-text-slate-600">
                                Body<Required />
                            </p>
                            <SummaryEditor id="summary" height={380} onInit={(editor) => (editorRef.current = editor)} />
                        </div>
                    </Channel>
                    <Channel icon={Smartphone} title="App push" on={formData.sendViaPush === 'yes'} onToggle={(on) => setChannel('sendViaPush', on)}>
                        <Field label={<>Title<Required /></>}>
                            <Input type="text" name="pushNotificationTitle" value={formData.pushNotificationTitle} onChange={handleTextChange} />
                        </Field>
                        <Field label={<>Message<Required /></>}>
                            <Textarea rows={3} name="pushNotificationBody" value={formData.pushNotificationBody} onChange={handleTextChange} />
                        </Field>
                        <Field label="Image" hint="Optional, shown in the notification where the phone supports it.">
                            <FileInput
                                accept="image/*"
                                name="pushNotificationImage"
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    if (e.target.files && e.target.files[0]) {
                                        setFormData({
                                            ...formData,
                                            pushNotificationImage: e.target.files[0]
                                        });
                                    }
                                }}
                            />
                        </Field>
                    </Channel>
                </div>

                <aside className="xl:tw-sticky xl:tw-top-24">
                    <Card className="tw-p-5">
                        <h2 className="tw-flex tw-items-center tw-gap-2 tw-text-sm tw-font-semibold tw-text-slate-900">
                            <BellRing className="tw-h-4 tw-w-4 tw-text-slate-400" aria-hidden /> Ready to send
                        </h2>
                        <dl className="tw-mt-3 tw-space-y-2 tw-text-sm">
                            <div className="tw-flex tw-justify-between tw-gap-3">
                                <dt className="tw-text-slate-500">To</dt>
                                <dd className="tw-text-right tw-font-medium tw-text-slate-900">{recipients.length ? `${recipients.length} user${recipients.length === 1 ? '' : 's'}` : 'All users'}</dd>
                            </div>
                            <div className="tw-flex tw-justify-between tw-gap-3">
                                <dt className="tw-text-slate-500">By</dt>
                                <dd className="tw-text-right tw-font-medium tw-text-slate-900">{channels.length ? channels.join(', ') : '—'}</dd>
                            </div>
                        </dl>
                        <Button variant="primary" type="submit" className="tw-mt-4 tw-w-full" disabled={loading || channels.length === 0}>
                            {loading ? <Loader2 className="tw-h-4 tw-w-4 tw-animate-spin" aria-hidden /> : <Send className="tw-h-4 tw-w-4" aria-hidden />}
                            {loading ? 'Sending…' : 'Send notification'}
                        </Button>
                        {channels.length === 0 && <p className="tw-mt-2 tw-text-center tw-text-xs tw-text-slate-500">Switch on at least one channel.</p>}
                    </Card>
                </aside>
            </form>

            <TableCard
                className="tw-mt-8"
                toolbar={
                    <div className="tw-flex tw-flex-col tw-gap-3">
                        <p className="tw-text-sm tw-font-semibold tw-text-slate-900">Sent before</p>
                        <div className="tw-grid tw-grid-cols-2 tw-gap-3 md:tw-grid-cols-3 xl:tw-grid-cols-[0.6fr_1fr_1fr_1fr_1.2fr_1.4fr_auto]">
                            <Field label="#">
                                <Input type="number" placeholder="ID" name="idManualNotifications" onChange={handleInputOnChange} value={filter.idManualNotifications} />
                            </Field>
                            {(['sendViaSms', 'sendViaEmail', 'sendViaPush'] as const).map((key) => (
                                <Field key={key} label={key === 'sendViaSms' ? 'SMS' : key === 'sendViaEmail' ? 'Email' : 'Push'}>
                                    <Select name={key} onChange={handleInputOnChange} value={filter[key]}>
                                        <option value="">Any</option>
                                        <option value="yes">Yes</option>
                                        <option value="no">No</option>
                                    </Select>
                                </Field>
                            ))}
                            <Field label="Sent on">
                                <Input placeholder="e.g. 2026-11" name="sendOn" onChange={handleInputOnChange} value={filter.sendOn} />
                            </Field>
                            <Field label="Sent by">
                                <Input placeholder="Name" name="createdBy" onChange={handleInputOnChange} value={filter.createdBy} />
                            </Field>
                            <div className="tw-flex tw-items-end">
                                {anyFilter && (
                                    <Button variant="ghost" onClick={() => setFilter({ ...INITIAL_FILTER, pageSize: filter.pageSize })}>
                                        <X className="tw-h-4 tw-w-4" aria-hidden /> Clear
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                }
                footer={<Pager page={filter.page} totalPages={pages} onChange={handlePageChange} summary={total ? `${total} sent · page ${filter.page} of ${pages}` : undefined} />}
            >
                <thead>
                    <tr>
                        <th className={cx(TH, 'tw-w-16')}>#</th>
                        <th className={TH}>SMS</th>
                        <th className={TH}>Email</th>
                        <th className={TH}>Push</th>
                        <th className={TH}>Sent on</th>
                        <th className={TH}>Sent by</th>
                        <th className={cx(TH, 'tw-text-right')}>
                            <span className="tw-sr-only">Open</span>
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {manualNotificationList.length > 0 ? manualNotificationList.map((notification) => (
                        <tr key={notification.idManualNotifications} className={TR}>
                            <td className={cx(TD, 'tw-tabular-nums tw-text-slate-400')}>{notification.idManualNotifications}</td>
                            <td className={TD}>{yesNo(notification.sendViaSms)}</td>
                            <td className={TD}>{yesNo(notification.sendViaEmail)}</td>
                            <td className={TD}>{yesNo(notification.sendViaPush)}</td>
                            <td className={cx(TD, 'tw-whitespace-nowrap tw-tabular-nums tw-text-slate-600')}>{notification.formattedSendOn}</td>
                            <td className={cx(TD, 'tw-text-slate-700')}>{notification?.User?.fullName || '—'}</td>
                            <td className={cx(TD, 'tw-text-right')}>
                                <Link
                                    href={`/notification/${notification.idManualNotifications}`}
                                    className="tw-inline-flex tw-h-8 tw-w-8 tw-items-center tw-justify-center tw-rounded-lg tw-text-slate-400 hover:tw-bg-slate-100 hover:tw-text-slate-700"
                                    aria-label={`Open notification ${notification.idManualNotifications}`}
                                >
                                    <ChevronRight className="tw-h-4 tw-w-4" aria-hidden />
                                </Link>
                            </td>
                        </tr>
                    )) : (
                        <EmptyRow colSpan={7} title="Nothing sent yet" hint={anyFilter ? 'Try fewer filters.' : undefined} />
                    )}
                </tbody>
            </TableCard>
        </div>
    );
}

export default ManualNotification;

ManualNotification.getLayout = function PageLayout(page: any) {
    return (
        <MainLayout>
            {page}
        </MainLayout>
    )
}
