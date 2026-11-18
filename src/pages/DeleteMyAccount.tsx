import Head from 'next/head';
import Link from 'next/link';
import React, { useEffect, useState, type ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Loader2, MailCheck } from 'lucide-react';
import { inter } from '@/ui/font';
import { cx } from '@/ui/primitives';
import { Button, Field, Input } from '@/ui/controls';

/**
 * Public account deletion (linked from the app stores). Two requests, unchanged:
 * POST /api/delete-user { userIdentifier } sends an OTP; PUT /api/delete-user
 * { otp, userIdentifier } confirms. Messages show on the page instead of in
 * alert boxes.
 */

// The server refuses a second OTP until the first expires (OTP_EXPIRY, 5 minutes).
const RETRY_SECONDS = 5 * 60;
const WEBSITE = 'https://digigramventures.com';

function Banner({ tone, children }: { tone: 'error' | 'info'; children: ReactNode }) {
    const Icon = tone === 'error' ? AlertCircle : MailCheck;
    return (
        <div
            role={tone === 'error' ? 'alert' : 'status'}
            className={cx(
                'tw-flex tw-items-start tw-gap-2.5 tw-rounded-xl tw-px-3.5 tw-py-3 tw-text-sm',
                tone === 'error' ? 'tw-bg-rose-50 tw-text-rose-800' : 'tw-bg-emerald-50 tw-text-emerald-800',
            )}
        >
            <Icon className="tw-mt-0.5 tw-h-4 tw-w-4 tw-shrink-0" aria-hidden />
            <span className="tw-min-w-0 tw-break-words">{children}</span>
        </div>
    );
}

function Steps({ stage }: { stage: number }) {
    const steps = ['Your account', 'Confirm'];
    return (
        <ol className="tw-mt-6 tw-flex tw-items-center tw-gap-3 tw-text-xs tw-font-medium">
            {steps.map((label, i) => {
                const n = i + 1;
                const active = stage === n;
                const done = stage > n;
                return (
                    <li key={label} className="tw-flex tw-items-center tw-gap-2">
                        {i > 0 && <span className="tw-h-px tw-w-6 tw-bg-slate-300" aria-hidden />}
                        <span
                            className={cx(
                                'tw-inline-flex tw-h-5 tw-w-5 tw-items-center tw-justify-center tw-rounded-full tw-text-[11px] tw-tabular-nums',
                                active ? 'tw-bg-brand-700 tw-text-white' : done ? 'tw-bg-brand-100 tw-text-brand-800' : 'tw-bg-slate-200 tw-text-slate-500',
                            )}
                        >
                            {n}
                        </span>
                        <span className={active ? 'tw-text-slate-900' : 'tw-text-slate-500'} aria-current={active ? 'step' : undefined}>
                            {label}
                        </span>
                    </li>
                );
            })}
        </ol>
    );
}

const AccountDeletionForm = () => {
    const [stage, setStage] = useState(1);
    const [userIdentifier, setUserIdentifier] = useState('');
    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [deleted, setDeleted] = useState(false);
    const [retryAt, setRetryAt] = useState<number | null>(null);
    const [now, setNow] = useState(() => Date.now());

    // One interval per OTP, cleared when it runs out or the page unmounts.
    useEffect(() => {
        if (retryAt === null) return;
        const id = window.setInterval(() => {
            const t = Date.now();
            setNow(t);
            if (t >= retryAt) window.clearInterval(id);
        }, 1000);
        return () => window.clearInterval(id);
    }, [retryAt]);

    useEffect(() => {
        if (!deleted) return;
        const id = window.setTimeout(() => window.location.replace(WEBSITE), 4000);
        return () => window.clearTimeout(id);
    }, [deleted]);

    const timer = retryAt === null ? 0 : Math.max(0, Math.ceil((retryAt - now) / 1000));

    const startTimer = () => {
        const t = Date.now();
        setNow(t);
        setRetryAt(t + RETRY_SECONDS * 1000);
    };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);

        if (!userIdentifier) {
            setError('Phone number or email is required');
            return;
        }

        if (stage === 1 && userIdentifier) {
            setLoading(true);
            try {
                const response = await fetch('/api/delete-user', {
                    method: 'POST',
                    body: JSON.stringify({ userIdentifier }),
                    headers: {
                        'Content-Type': 'application/json',
                    },
                });
                if (!response.ok) {
                    const data = await response.json();
                    setError('Failed: ' + data.message);
                    return;
                }
                startTimer();
                setOtp('');
                setStage(2);
            } catch {
                setError('Something went wrong. Check your connection and try again.');
            } finally {
                setLoading(false);
            }
        } else if (stage === 2 && otp) {
            setLoading(true);
            try {
                const response = await fetch('/api/delete-user', {
                    method: 'PUT',
                    body: JSON.stringify({ otp, userIdentifier }),
                    headers: {
                        'Content-Type': 'application/json',
                    },
                });
                if (!response.ok) {
                    const data = await response.json();
                    setError('Failed to delete account: ' + data.message);
                    return;
                }
                setDeleted(true);
            } catch {
                setError('Something went wrong. Check your connection and try again.');
            } finally {
                setLoading(false);
            }
        }
    };

    const startAgain = () => {
        setError(null);
        setStage(1);
    };

    return (
        <>
            <Head>
                <title>Delete your account · Shathi</title>
                <meta content="width=device-width, initial-scale=1" name="viewport" />
            </Head>
            <div className={cx(inter.variable, 'ui tw-flex tw-min-h-screen tw-flex-col tw-bg-slate-50')}>
                <main className="tw-mx-auto tw-flex tw-w-full tw-max-w-md tw-flex-1 tw-flex-col tw-justify-center tw-px-5 tw-py-12">
                    <span className="tw-mb-8 tw-self-start tw-rounded-2xl tw-bg-[#0b1238] tw-px-4 tw-py-2.5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/assets/images/logo-header.png" alt="Shathi" className="tw-h-8 tw-w-auto" />
                    </span>

                    {deleted ? (
                        <div className="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-6 tw-shadow-card" role="status">
                            <CheckCircle2 className="tw-h-8 tw-w-8 tw-text-brand-600" aria-hidden />
                            <h1 className="tw-mt-4 tw-text-xl tw-font-semibold tw-tracking-tight tw-text-slate-900">Account deleted successfully</h1>
                            <p className="tw-mt-1.5 tw-text-sm tw-text-slate-500">Taking you to digigramventures.com…</p>
                            <a href={WEBSITE} className="tw-mt-4 tw-inline-block tw-text-sm tw-font-semibold tw-text-brand-700 hover:tw-underline">
                                Go now
                            </a>
                        </div>
                    ) : (
                        <>
                            <h1 className="tw-text-2xl tw-font-semibold tw-tracking-tight tw-text-slate-900">Delete your account</h1>
                            <p className="tw-mt-1.5 tw-text-sm tw-text-slate-500">
                                {stage === 1 ? 'We send a one-time code (OTP) to confirm the account is yours.' : 'Enter the OTP to confirm.'}
                            </p>
                            <Steps stage={stage} />

                            <form onSubmit={handleSubmit} className="tw-mt-6 tw-space-y-5 tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-6 tw-shadow-card">
                                {error && <Banner tone="error">{error}</Banner>}
                                {stage === 2 && !error && <Banner tone="info">An OTP has been sent to {userIdentifier}.</Banner>}

                                {stage === 1 && (
                                    <Field label="Phone number or email" hint="Enter the phone number or email associated with your account">
                                        <Input
                                            id="formUserIdentifier"
                                            type="text"
                                            placeholder="Enter phone number or email"
                                            autoComplete="username"
                                            value={userIdentifier}
                                            onChange={(e) => setUserIdentifier(e.target.value)}
                                            required
                                        />
                                    </Field>
                                )}
                                {stage === 2 && (
                                    <Field label="OTP" hint="Please check your email or phone for the OTP. You may have to check your spam folder.">
                                        <Input
                                            id="formOtp"
                                            type="text"
                                            inputMode="numeric"
                                            autoComplete="one-time-code"
                                            placeholder="6-digit OTP"
                                            value={otp}
                                            onChange={(e) => setOtp(e.target.value)}
                                            required
                                        />
                                    </Field>
                                )}

                                {stage === 1 && (
                                    <Button disabled={loading} variant="primary" type="submit" className="tw-w-full">
                                        {loading && <Loader2 className="tw-h-4 tw-w-4 tw-animate-spin" aria-hidden />}
                                        Request OTP
                                    </Button>
                                )}
                                {stage === 2 && (
                                    <div className="tw-flex tw-flex-col tw-gap-2">
                                        <Button disabled={loading} variant="danger" type="submit" className="tw-w-full">
                                            {loading && <Loader2 className="tw-h-4 tw-w-4 tw-animate-spin" aria-hidden />}
                                            Delete my account
                                        </Button>
                                        <Button onClick={startAgain} disabled={timer > 0} variant="secondary" type="button" className="tw-w-full">
                                            Start again
                                            {timer > 0 && (
                                                <span className="tw-tabular-nums tw-text-slate-400">
                                                    in {Math.floor(timer / 60)}:{String(timer % 60).padStart(2, '0')}
                                                </span>
                                            )}
                                        </Button>
                                    </div>
                                )}
                            </form>
                        </>
                    )}

                    <p className="tw-mt-8 tw-text-xs tw-text-slate-400">
                        Shathi · DigiGram Ventures ·{' '}
                        <Link href="/privacy" className="tw-text-slate-500 hover:tw-text-slate-700 hover:tw-underline">
                            Privacy policy
                        </Link>
                    </p>
                </main>
            </div>
        </>
    );
};

export default AccountDeletionForm;
