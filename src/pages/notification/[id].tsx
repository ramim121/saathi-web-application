/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from "next/router";
import MainLayout from "@/layouts/MainLayout";
import { getRequestOptions } from "@/utils/Fetch";
import Swal from "sweetalert2";
import { S3_URL } from '@/config/public';
import { ArrowLeft, ImageOff, Mail, MessageSquare, Smartphone, type LucideIcon } from 'lucide-react';
import { Card, Pill, SafeImg, Skeleton } from '@/ui/primitives';

interface DetailsProps {
    idManualNotifications: number;
    User: {
        fullName: string;
    },
    emailBody: string;
    emailSubject: string;
    pushNotificationBody: string;
    pushNotificationImage: string;
    pushNotificationTitle: number;
    formattedSendOn: string;
    sendViaEmail: string;
    sendViaPush: string;
    sendViaSms: string;
    smsBody: string;
}

function ChannelCard({ icon: Icon, title, sent, children }: { icon: LucideIcon; title: string; sent: boolean; children: React.ReactNode }) {
    return (
        <Card className="tw-p-5">
            <div className="tw-flex tw-items-center tw-justify-between tw-gap-2">
                <h2 className="tw-flex tw-items-center tw-gap-2 tw-text-sm tw-font-semibold tw-text-slate-900">
                    <Icon className="tw-h-4 tw-w-4 tw-text-slate-400" aria-hidden /> {title}
                </h2>
                {sent ? <Pill tone="green">Sent</Pill> : <Pill tone="slate" dot={false}>Not used</Pill>}
            </div>
            {sent && <div className="tw-mt-3 tw-space-y-3 tw-text-sm tw-text-slate-700">{children}</div>}
        </Card>
    );
}

function Details() {
    const router = useRouter();
    const { id } = router.query;
    const [details, setDetails] = useState<DetailsProps>({} as DetailsProps);

    useEffect(() => {
        if (id != undefined) {
            fetchManualNotificationDetails();
        }
    }, [id]);

    const fetchManualNotificationDetails = async () => {
        try {
            const res = await fetch('/api/manual-notification/details/' + id, getRequestOptions());
            const data = await res.json();
            if (res.status === 200) {
                setDetails(data.data);
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

    const loaded = Boolean(details.idManualNotifications);

    return (
        <div className="ui">
            <Link href="/notification" className="tw-mb-3 tw-inline-flex tw-items-center tw-gap-1.5 tw-text-sm tw-font-medium tw-text-slate-500 hover:tw-text-slate-900">
                <ArrowLeft className="tw-h-4 tw-w-4" aria-hidden /> Notifications
            </Link>
            <div className="tw-mb-6">
                <p className="tw-text-xs tw-font-semibold tw-uppercase tw-tracking-[0.14em] tw-text-brand-700">Notification{loaded ? ` #${details.idManualNotifications}` : ''}</p>
                {loaded ? (
                    <h1 className="tw-mt-1 tw-text-[26px] tw-font-semibold tw-leading-8 tw-tracking-tight tw-text-slate-900">Sent {details.formattedSendOn}</h1>
                ) : (
                    <Skeleton className="tw-mt-2 tw-h-7 tw-w-64" />
                )}
                {loaded && <p className="tw-mt-1 tw-text-sm tw-text-slate-500">by {details.User?.fullName || 'unknown'}</p>}
            </div>

            {loaded && (
                <div className="tw-grid tw-grid-cols-1 tw-gap-4 lg:tw-grid-cols-3">
                    <ChannelCard icon={MessageSquare} title="SMS" sent={details.sendViaSms === 'yes'}>
                        <p className="tw-whitespace-pre-line">{details.smsBody}</p>
                    </ChannelCard>
                    <ChannelCard icon={Mail} title="Email" sent={details.sendViaEmail === 'yes'}>
                        <p className="tw-font-semibold tw-text-slate-900">{details.emailSubject}</p>
                        <div className="ui-prose" dangerouslySetInnerHTML={{ __html: details.emailBody }} />
                    </ChannelCard>
                    <ChannelCard icon={Smartphone} title="App push" sent={details.sendViaPush === 'yes'}>
                        <p className="tw-font-semibold tw-text-slate-900">{details.pushNotificationTitle}</p>
                        <p className="tw-whitespace-pre-line">{details.pushNotificationBody}</p>
                        {details.pushNotificationImage && (
                            <SafeImg
                                src={`${S3_URL}push-notification/${details.pushNotificationImage}`}
                                alt="Push notification image"
                                className="tw-max-h-48 tw-rounded-xl tw-object-contain tw-ring-1 tw-ring-slate-200"
                                fallback={
                                    <span className="tw-flex tw-h-24 tw-items-center tw-justify-center tw-rounded-xl tw-bg-slate-50 tw-text-slate-300">
                                        <ImageOff className="tw-h-6 tw-w-6" aria-hidden />
                                    </span>
                                }
                            />
                        )}
                    </ChannelCard>
                </div>
            )}
        </div>
    );
}

export default Details;

Details.getLayout = function PageLayout(page: any) {
    return (
        <MainLayout>
            {page}
        </MainLayout>
    )
}
