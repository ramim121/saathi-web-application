import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Modal } from 'react-bootstrap';
import { Banknote, History, Loader2, X } from 'lucide-react';
import { API_URL } from '@/config/public';
import { getRequestOptions, postRequestOptions } from '@/utils/Fetch';
import { bdtExact } from '@/ui/format';
import { dhakaStamp } from '@/ui/status';
import { Pill, cx, type Tone } from '@/ui/primitives';
import { Button, Field, Input } from '@/ui/controls';

/**
 * Money held for an investor between investments (investor_balance_entries):
 * profit owed after a capital-only reinvestment, and what did not make a whole
 * unit. Shows the amount, its history, and records a payout.
 */

type Entry = {
    id: number;
    amount: number;
    entryType: string;
    note: string | null;
    idProjectInvestmentBookings: number | null;
    bookingRef: string | null;
    createdBy: string | null;
    createdAt: string;
};

const TYPE: Record<string, { label: string; tone: Tone }> = {
    profit_payable: { label: 'Profit to pay out', tone: 'amber' },
    reinvest_remainder: { label: 'Left over from a reinvestment', tone: 'sky' },
    applied_to_booking: { label: 'Used toward a booking', tone: 'violet' },
    paid_out: { label: 'Paid out', tone: 'green' },
    reversal: { label: 'Reversed', tone: 'slate' },
    adjustment: { label: 'Adjustment', tone: 'slate' },
};

export function InvestorBalance({ idUsers, investorName, refreshKey }: { idUsers: number; investorName: string; refreshKey: number }) {
    const [data, setData] = useState<{ balance: number; entries: Entry[] } | null>(null);
    const [showHistory, setShowHistory] = useState(false);
    const [showPayout, setShowPayout] = useState(false);
    const [amount, setAmount] = useState('');
    const [note, setNote] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [tick, setTick] = useState(0);

    useEffect(() => {
        if (!idUsers) return;
        let live = true;
        fetch(`/api/investors/balance/${idUsers}`, getRequestOptions())
            .then((r) => (r.ok ? r.json() : null))
            .then((body) => live && setData(body?.data ?? { balance: 0, entries: [] }))
            .catch(() => live && setData({ balance: 0, entries: [] }));
        return () => {
            live = false;
        };
    }, [idUsers, refreshKey, tick]);

    const openPayout = () => {
        setAmount(data && data.balance > 0 ? String(data.balance) : '');
        setNote('');
        setError(null);
        setShowPayout(true);
    };

    const recordPayout = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        try {
            const res = await fetch(API_URL + 'api/investors/balance/payout', postRequestOptions({ idUsers, amount: Number(amount), note }));
            const body = await res.json();
            if (!res.ok) {
                setError(String(body.message || 'Could not record the payout.').replace(/<br>/g, ' '));
                return;
            }
            setShowPayout(false);
            setTick((t) => t + 1);
        } catch {
            setError('Could not reach the server. Nothing was saved.');
        } finally {
            setSaving(false);
        }
    };

    if (!data) return <div className="tw-h-5 tw-w-32 tw-animate-pulse tw-rounded tw-bg-slate-100" aria-hidden />;
    const { balance, entries } = data;

    return (
        <>
            <div className="tw-flex tw-flex-wrap tw-items-center tw-justify-end tw-gap-2">
                <span className={cx('tw-font-semibold tw-tabular-nums', balance > 0 ? 'tw-text-sky-700' : balance < 0 ? 'tw-text-amber-700' : 'tw-text-slate-500')}>
                    {bdtExact(balance)}
                </span>
                {entries.length > 0 && (
                    <button type="button" onClick={() => setShowHistory(true)} className="tw-inline-flex tw-items-center tw-gap-1 tw-text-xs tw-font-semibold tw-text-slate-500 hover:tw-text-slate-800">
                        <History className="tw-h-3.5 tw-w-3.5" aria-hidden /> History
                    </button>
                )}
                {balance > 0 && (
                    <Button size="sm" variant="secondary" onClick={openPayout}>
                        <Banknote className="tw-h-3.5 tw-w-3.5" aria-hidden /> Record payout
                    </Button>
                )}
            </div>

            <Modal show={showHistory} onHide={() => setShowHistory(false)} size="lg">
                <div className="ui">
                    <div className="tw-flex tw-items-start tw-justify-between tw-border-b tw-border-slate-100 tw-px-6 tw-py-4">
                        <div>
                            <h2 className="tw-text-lg tw-font-semibold tw-text-slate-900">Held for {investorName}</h2>
                            <p className="tw-text-sm tw-text-slate-500">
                                Now <strong className="tw-tabular-nums">{bdtExact(balance)}</strong>. Newest first.
                            </p>
                        </div>
                        <button type="button" onClick={() => setShowHistory(false)} className="tw-rounded-lg tw-p-1.5 tw-text-slate-400 hover:tw-bg-slate-100" aria-label="Close">
                            <X className="tw-h-5 tw-w-5" aria-hidden />
                        </button>
                    </div>
                    <div className="tw-max-h-[60vh] tw-overflow-y-auto tw-px-6 tw-py-3">
                        <table className="tw-w-full tw-text-sm">
                            <tbody>
                                {entries.map((e) => (
                                    <tr key={e.id} className="tw-border-b tw-border-slate-100 last:tw-border-0">
                                        <td className="tw-py-2.5 tw-pr-3 tw-align-top">
                                            <Pill tone={TYPE[e.entryType]?.tone ?? 'slate'} dot={false}>
                                                {TYPE[e.entryType]?.label ?? e.entryType}
                                            </Pill>
                                            <div className="tw-mt-1 tw-text-xs tw-text-slate-500">
                                                {e.note}
                                                {e.bookingRef && e.idProjectInvestmentBookings && (
                                                    <>
                                                        {' · '}
                                                        <Link href={`/bookings/details/${e.idProjectInvestmentBookings}`} className="tw-font-medium tw-text-brand-700 hover:tw-underline" onClick={() => setShowHistory(false)}>
                                                            #{e.bookingRef}
                                                        </Link>
                                                    </>
                                                )}
                                            </div>
                                            <div className="tw-text-[11px] tw-text-slate-400">
                                                {dhakaStamp(e.createdAt)}
                                                {e.createdBy ? ` · ${e.createdBy}` : ''}
                                            </div>
                                        </td>
                                        <td className={cx('tw-whitespace-nowrap tw-py-2.5 tw-text-right tw-align-top tw-font-semibold tw-tabular-nums', e.amount >= 0 ? 'tw-text-slate-900' : 'tw-text-slate-500')}>
                                            {e.amount >= 0 ? '+' : '−'}
                                            {bdtExact(Math.abs(e.amount))}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </Modal>

            <Modal show={showPayout} onHide={() => !saving && setShowPayout(false)}>
                <form className="ui" onSubmit={recordPayout}>
                    <div className="tw-border-b tw-border-slate-100 tw-px-6 tw-py-4">
                        <h2 className="tw-text-lg tw-font-semibold tw-text-slate-900">Record a payout</h2>
                        <p className="tw-text-sm tw-text-slate-500">
                            Money you have sent to {investorName}. {bdtExact(balance)} is held for them.
                        </p>
                    </div>
                    <div className="tw-space-y-4 tw-px-6 tw-py-5">
                        <Field label="Amount paid (BDT)">
                            <Input type="number" min={0.01} max={balance} step="any" value={amount} onChange={(e) => setAmount(e.target.value)} required autoFocus />
                        </Field>
                        <Field label="How it was paid" hint="Bank transfer reference, cheque number or similar, so the payout can be traced.">
                            <Input type="text" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} required placeholder="e.g. BEFTN ref 8812-55 to DBBL ••••1234" />
                        </Field>
                        {error && <p className="tw-rounded-xl tw-bg-rose-50 tw-px-4 tw-py-3 tw-text-sm tw-text-rose-800" role="alert">{error}</p>}
                    </div>
                    <div className="tw-flex tw-justify-end tw-gap-2 tw-border-t tw-border-slate-100 tw-bg-slate-50/60 tw-px-6 tw-py-3">
                        <Button variant="secondary" onClick={() => setShowPayout(false)} disabled={saving}>
                            Cancel
                        </Button>
                        <Button variant="primary" type="submit" disabled={saving || !(Number(amount) > 0) || !note.trim()}>
                            {saving && <Loader2 className="tw-h-4 tw-w-4 tw-animate-spin" aria-hidden />}
                            Record payout
                        </Button>
                    </div>
                </form>
            </Modal>
        </>
    );
}
