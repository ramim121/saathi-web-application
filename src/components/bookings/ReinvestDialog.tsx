import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Modal } from 'react-bootstrap';
import { ArrowLeft, ArrowRight, CheckCircle2, Coins, Loader2, Minus, PiggyBank, Plus, Repeat, TriangleAlert, X } from 'lucide-react';
import { API_URL } from '@/config/public';
import { getRequestOptions, postRequestOptions } from '@/utils/Fetch';
import { addTerm, defaultUnits, planReinvestment, type ReinvestMode, type ReinvestPlan } from '@/utils/reinvestment';
import { bdtExact, date } from '@/ui/format';
import { Pill, Skeleton, cx } from '@/ui/primitives';
import { Button, Field, Input, Select } from '@/ui/controls';

/**
 * Reinvest a matured investment line, step by step:
 *   1. What matured: capital and the actual profit.
 *   2. How to reinvest it (three options, with their figures) and into what.
 *   3. Review, then create the new booking on the investor's account.
 * The figures come from src/utils/reinvestment.ts, the same code the API
 * uses to save, so what is shown is what is recorded.
 */

type ProjectOption = {
    idProjects: number;
    projectName: string;
    unitInvestmentValue: number;
    duration: number;
    tenure: string;
    returnRangeMin: number;
    returnRangeMax: number;
    remainingUnits: number | null;
};

type Options = {
    source: {
        idProjectInvestors: number;
        idProjectInvestmentBookings: number | null;
        bookingRef: string | null;
        units: number;
        capital: number;
        /** The matured line's partner (its first allocation). */
        idProjectPartners: number | null;
        status: string;
        maturityDate: string | null;
        profitRecorded: boolean;
        actualProfit: number | null;
        actualProfitPercentage: number | null;
        expectedProfit: { min: number; max: number };
        eligible: boolean;
        reason: string | null;
        project: { idProjects: number; projectName: string; unitInvestmentValue: number; returnRangeMin: number; returnRangeMax: number };
        investor: { idUsers: number; fullName: string | null; phoneNumber: string | null; email: string | null; channels: { sms: boolean; email: boolean } };
    };
    balance: number;
    projects: ProjectOption[];
};

type Partner = { idProjectPartners: number; partnerUnitCapacity: number; investorConfirmedBookingCount?: number; User?: { fullName?: string | null } };

type Result = {
    newBookingId: number;
    newBookingRef: string;
    topUp: number;
    investment: number;
    payout: number;
    payoutDoneNow: boolean;
    kept: number;
    fromBalance: number;
    startDate: string | null;
    maturityDate: string | null;
    projectName: string;
    notified: boolean;
};

type Step = 'profit' | 'plan' | 'review' | 'done';

const MODE_TEXT: Record<ReinvestMode, { title: string; line: string; icon: typeof Repeat }> = {
    capital_only: { title: 'Reinvest the capital', line: 'The profit is paid out to the investor.', icon: Coins },
    capital_profit: { title: 'Reinvest capital + profit', line: 'What does not make a whole unit stays in the investor’s balance.', icon: Repeat },
    top_up: { title: 'Reinvest with a top-up', line: 'Invest more: the investor pays the difference.', icon: PiggyBank },
};

const todayIso = () => new Date().toISOString().slice(0, 10);
const money = (n: number) => bdtExact(Math.round(n * 100) / 100);
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

function Row({ label, value, strong, tone }: { label: React.ReactNode; value: React.ReactNode; strong?: boolean; tone?: 'brand' | 'amber' | 'sky' }) {
    return (
        <div className={cx('tw-flex tw-items-baseline tw-justify-between tw-gap-4 tw-py-1.5', strong && 'tw-font-semibold')}>
            <dt className={cx('tw-text-sm', strong ? 'tw-text-slate-900' : 'tw-text-slate-600')}>{label}</dt>
            <dd
                className={cx(
                    'tw-whitespace-nowrap tw-text-sm tw-tabular-nums',
                    tone === 'brand' ? 'tw-font-semibold tw-text-brand-700' : tone === 'amber' ? 'tw-font-semibold tw-text-amber-700' : tone === 'sky' ? 'tw-font-semibold tw-text-sky-700' : 'tw-text-slate-900',
                )}
            >
                {value}
            </dd>
        </div>
    );
}

export function ReinvestDialog({ idProjectInvestors, onClose, onDone }: { idProjectInvestors: number | null; onClose: () => void; onDone: () => void }) {
    const open = idProjectInvestors !== null;
    const [options, setOptions] = useState<Options | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [step, setStep] = useState<Step>('profit');
    const [profitPct, setProfitPct] = useState('');
    const [profitAmount, setProfitAmount] = useState('');
    const [mode, setMode] = useState<ReinvestMode>('capital_profit');
    const [idProjects, setIdProjects] = useState<number | null>(null);
    const [units, setUnits] = useState(0);
    const [partners, setPartners] = useState<Partner[] | null>(null);
    const [idProjectPartners, setIdProjectPartners] = useState<number | null>(null);
    const [useBalance, setUseBalance] = useState(true);
    const [startDate, setStartDate] = useState(todayIso());
    const [payoutDoneNow, setPayoutDoneNow] = useState(false);
    const [notify, setNotify] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [result, setResult] = useState<Result | null>(null);

    // Load (or reset) whenever the dialog opens for a line.
    useEffect(() => {
        if (!open) return;
        let live = true;
        setOptions(null);
        setLoadError(null);
        setStep('profit');
        setResult(null);
        setSaveError(null);
        setPayoutDoneNow(false);
        setNotify(true);
        setStartDate(todayIso());
        fetch(`/api/bookings/reinvestment/options?idProjectInvestors=${idProjectInvestors}`, getRequestOptions())
            .then(async (r) => ({ ok: r.ok, body: await r.json() }))
            .then(({ ok, body }) => {
                if (!live) return;
                if (!ok) return setLoadError(body.message || 'Could not load this investment.');
                const o = body.data as Options;
                setOptions(o);
                if (o.source.profitRecorded && o.source.actualProfit !== null) {
                    setProfitAmount(String(o.source.actualProfit));
                    setProfitPct(o.source.actualProfitPercentage !== null ? String(o.source.actualProfitPercentage) : '');
                } else {
                    setProfitAmount('');
                    setProfitPct('');
                }
                const same = o.projects.find((p) => p.idProjects === o.source.project.idProjects);
                setIdProjects((same ?? o.projects[0])?.idProjects ?? null);
                setUseBalance(o.balance > 0);
                setMode('capital_profit');
            })
            .catch(() => live && setLoadError('Could not load this investment.'));
        return () => {
            live = false;
        };
    }, [open, idProjectInvestors]);

    const project = options?.projects.find((p) => p.idProjects === idProjects) ?? null;
    const capital = options?.source.capital ?? 0;
    const profit = Number(profitAmount);
    const profitValid = profitAmount.trim() !== '' && Number.isFinite(profit) && profit >= 0;
    const balance = options?.balance ?? 0;

    // Partners of the chosen project (as on the New booking page).
    useEffect(() => {
        if (!idProjects) return;
        let live = true;
        setPartners(null);
        setIdProjectPartners(null);
        fetch(`/api/projects/project-partners/${idProjects}`, getRequestOptions())
            .then((r) => r.json())
            .then((body) => {
                if (!live) return;
                const list: Partner[] = Array.isArray(body?.data) ? body.data : [];
                setPartners(list);
                // Back into the same project: stay with the same partner when it is listed.
                const same = idProjects === options?.source.project.idProjects ? options?.source.idProjectPartners : null;
                setIdProjectPartners(list.find((p) => p.idProjectPartners === same)?.idProjectPartners ?? list[0]?.idProjectPartners ?? null);
            })
            .catch(() => live && setPartners([]));
        return () => {
            live = false;
        };
        // Per project only: `options` has loaded before a project can be chosen
        // and does not change while the dialog is open.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [idProjects]);

    const planFor = (m: ReinvestMode, u?: number): ReinvestPlan | null => {
        if (!project || !profitValid) return null;
        const base = { mode: m, capital, profit, balance, useBalance, unitValue: project.unitInvestmentValue };
        return planReinvestment({ ...base, units: u ?? defaultUnits(base) });
    };

    // A new mode, project or profit starts from that option's natural number of
    // units (the profit is typed digit by digit on step 1, so it must count).
    useEffect(() => {
        if (!project || !profitValid) return;
        setUnits(defaultUnits({ mode, capital, profit, balance, useBalance, unitValue: project.unitInvestmentValue }));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mode, idProjects, profitValid, profit, useBalance]);

    const plan = useMemo(() => planFor(mode, units), [mode, units, project, profitValid, profit, balance, useBalance]); // eslint-disable-line react-hooks/exhaustive-deps
    const overProject = project?.remainingUnits !== null && project?.remainingUnits !== undefined && units > project.remainingUnits;
    const planProblem = !project ? 'Choose a project.' : plan?.problem ?? (overProject ? `${project.projectName} has ${project.remainingUnits} unit(s) left.` : !idProjectPartners ? 'Choose a partner.' : null);
    const topUpDue = (plan?.topUp ?? 0) > 0;
    const newMaturity = project && plan ? addTerm(topUpDue ? todayIso() : startDate, project.duration, project.tenure) : null;

    const setPct = (v: string) => {
        setProfitPct(v);
        const n = Number(v);
        setProfitAmount(v.trim() !== '' && Number.isFinite(n) ? String(Math.round(capital * n) / 100) : '');
    };
    const setAmount = (v: string) => {
        setProfitAmount(v);
        const n = Number(v);
        setProfitPct(v.trim() !== '' && Number.isFinite(n) && capital > 0 ? String(Math.round((n / capital) * 10000) / 100) : '');
    };

    const submit = async () => {
        if (!options || !plan || planProblem) return;
        setSaving(true);
        setSaveError(null);
        try {
            const res = await fetch(
                API_URL + 'api/bookings/reinvestment',
                postRequestOptions({
                    idProjectInvestors: options.source.idProjectInvestors,
                    mode,
                    profitAmount: profit,
                    profitPercentage: profitPct.trim() === '' ? null : Number(profitPct),
                    idProjects,
                    units,
                    idProjectPartners,
                    useBalance: mode !== 'capital_only' && useBalance && balance > 0,
                    startDate: topUpDue ? null : startDate,
                    payoutDoneNow: mode === 'capital_only' && payoutDoneNow,
                    notify,
                }),
            );
            const body = await res.json();
            if (!res.ok) {
                setSaveError(String(body.message || 'Could not create the reinvestment.').replace(/<br>/g, ' '));
                return;
            }
            setResult(body.data);
            setStep('done');
            onDone();
        } catch {
            setSaveError('Could not reach the server. Nothing was saved.');
        } finally {
            setSaving(false);
        }
    };

    const src = options?.source;
    const stepIndex = { profit: 0, plan: 1, review: 2, done: 3 }[step];

    return (
        <Modal show={open} onHide={onClose} size="xl" backdrop={saving ? 'static' : true} keyboard={!saving} aria-labelledby="reinvest-title">
            <div className="ui">
                <div className="tw-flex tw-items-start tw-justify-between tw-gap-4 tw-border-b tw-border-slate-100 tw-px-6 tw-py-4">
                    <div className="tw-min-w-0">
                        <h2 id="reinvest-title" className="tw-text-lg tw-font-semibold tw-text-slate-900">
                            Reinvest {src?.bookingRef ? `booking #${src.bookingRef}` : 'matured investment'}
                        </h2>
                        <p className="tw-mt-0.5 tw-text-sm tw-text-slate-500">
                            {src ? `${src.investor.fullName || 'Investor'} · ${src.project.projectName} · ${plural(src.units, 'unit')}` : ' '}
                        </p>
                    </div>
                    <button type="button" onClick={onClose} disabled={saving} className="tw-rounded-lg tw-p-1.5 tw-text-slate-400 hover:tw-bg-slate-100 hover:tw-text-slate-600" aria-label="Close">
                        <X className="tw-h-5 tw-w-5" aria-hidden />
                    </button>
                </div>

                {step !== 'done' && src?.eligible && (
                    <ol className="tw-flex tw-items-center tw-gap-2 tw-border-b tw-border-slate-100 tw-bg-slate-50/60 tw-px-6 tw-py-2.5 tw-text-xs tw-font-medium" aria-label="Steps">
                        {['What matured', 'How to reinvest', 'Review'].map((label, i) => (
                            <li key={label} className="tw-flex tw-items-center tw-gap-2">
                                {i > 0 && <span className="tw-h-px tw-w-6 tw-bg-slate-300" aria-hidden />}
                                <span
                                    className={cx(
                                        'tw-inline-flex tw-h-5 tw-w-5 tw-items-center tw-justify-center tw-rounded-full tw-text-[11px]',
                                        i === stepIndex ? 'tw-bg-brand-700 tw-text-white' : i < stepIndex ? 'tw-bg-brand-100 tw-text-brand-800' : 'tw-bg-slate-200 tw-text-slate-500',
                                    )}
                                >
                                    {i + 1}
                                </span>
                                <span className={i === stepIndex ? 'tw-text-slate-900' : 'tw-text-slate-500'} aria-current={i === stepIndex ? 'step' : undefined}>
                                    {label}
                                </span>
                            </li>
                        ))}
                    </ol>
                )}

                <div className="tw-px-6 tw-py-5">
                    {loadError && <p className="tw-rounded-xl tw-bg-rose-50 tw-px-4 tw-py-3 tw-text-sm tw-text-rose-800">{loadError}</p>}
                    {!options && !loadError && (
                        <div className="tw-space-y-3" aria-busy="true">
                            <Skeleton className="tw-h-5 tw-w-1/3" />
                            <Skeleton className="tw-h-24 tw-w-full" />
                        </div>
                    )}

                    {src && !src.eligible && (
                        <div className="tw-flex tw-gap-3 tw-rounded-xl tw-bg-amber-50 tw-px-4 tw-py-3 tw-text-sm tw-text-amber-900">
                            <TriangleAlert className="tw-mt-0.5 tw-h-4 tw-w-4 tw-shrink-0" aria-hidden />
                            <p>{src.reason}</p>
                        </div>
                    )}

                    {/* ---------------------------------------------------- step 1 */}
                    {src?.eligible && step === 'profit' && (
                        <div className="tw-grid tw-gap-6 md:tw-grid-cols-[minmax(0,1fr)_18rem]">
                            <div className="tw-space-y-5">
                                <div>
                                    <h3 className="tw-text-sm tw-font-semibold tw-text-slate-900">What matured</h3>
                                    <p className="tw-mt-0.5 tw-text-sm tw-text-slate-500">
                                        {src.maturityDate ? `Matured on ${date(src.maturityDate)}.` : 'Matured.'} The capital is what was recorded when it was booked.
                                    </p>
                                </div>
                                <div className="tw-grid tw-gap-4 sm:tw-grid-cols-2">
                                    <Field label="Actual profit (%)" hint={`Expected ${src.project.returnRangeMin}–${src.project.returnRangeMax}%: ${money(src.expectedProfit.min)}–${money(src.expectedProfit.max)}`}>
                                        <Input type="number" inputMode="decimal" min={0} step="any" placeholder="e.g. 8.25" value={profitPct} onChange={(e) => setPct(e.target.value)} autoFocus={!src.profitRecorded} />
                                    </Field>
                                    <Field label="Actual profit (BDT)" hint={src.profitRecorded ? 'Recorded when it was marked ready for withdrawal. Change it only to correct it.' : 'Fills in from the %, or type the exact amount.'}>
                                        <Input type="number" inputMode="decimal" min={0} step="any" placeholder="e.g. 16500" value={profitAmount} onChange={(e) => setAmount(e.target.value)} />
                                    </Field>
                                </div>
                                {profitAmount.trim() !== '' && !profitValid && <p className="tw-text-sm tw-text-rose-600">Enter a profit of 0 or more. A loss is settled with “Mark ready for withdrawal”, not here.</p>}
                            </div>
                            <dl className="tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-slate-50/60 tw-p-4">
                                <Row label="Capital" value={money(capital)} />
                                <Row label="Profit" value={profitValid ? money(profit) : '—'} />
                                <div className="tw-my-1 tw-border-t tw-border-slate-200" />
                                <Row label="Total at maturity" value={profitValid ? money(capital + profit) : '—'} strong />
                                {balance !== 0 && <Row label="Already held for the investor" value={money(balance)} tone={balance > 0 ? 'sky' : 'amber'} />}
                            </dl>
                        </div>
                    )}

                    {/* ---------------------------------------------------- step 2 */}
                    {src?.eligible && step === 'plan' && (
                        <div className="tw-grid tw-gap-6 lg:tw-grid-cols-[minmax(0,1fr)_20rem]">
                            <div className="tw-space-y-5">
                                <div role="radiogroup" aria-label="How to reinvest" className="tw-grid tw-gap-3 md:tw-grid-cols-3">
                                    {(['capital_only', 'capital_profit', 'top_up'] as ReinvestMode[]).map((m) => {
                                        const t = MODE_TEXT[m];
                                        const p = planFor(m);
                                        const Icon = t.icon;
                                        const active = mode === m;
                                        return (
                                            <button
                                                key={m}
                                                type="button"
                                                role="radio"
                                                aria-checked={active}
                                                onClick={() => setMode(m)}
                                                className={cx(
                                                    'tw-flex tw-flex-col tw-gap-2 tw-rounded-2xl tw-border tw-p-4 tw-text-left tw-transition focus-visible:tw-outline-none focus-visible:tw-ring-2 focus-visible:tw-ring-brand-500',
                                                    active ? 'tw-border-brand-600 tw-bg-brand-50/60 tw-ring-1 tw-ring-brand-600' : 'tw-border-slate-200 tw-bg-white hover:tw-border-slate-300',
                                                )}
                                            >
                                                <span className="tw-flex tw-items-center tw-gap-2">
                                                    <span className={cx('tw-inline-flex tw-h-7 tw-w-7 tw-items-center tw-justify-center tw-rounded-lg', active ? 'tw-bg-brand-700 tw-text-white' : 'tw-bg-slate-100 tw-text-slate-500')}>
                                                        <Icon className="tw-h-4 tw-w-4" aria-hidden />
                                                    </span>
                                                    <span className="tw-text-sm tw-font-semibold tw-text-slate-900">{t.title}</span>
                                                </span>
                                                <span className="tw-text-xs tw-leading-5 tw-text-slate-500">{t.line}</span>
                                                {p && !p.problem && (
                                                    <span className="tw-mt-auto tw-text-xs tw-font-medium tw-text-slate-700">
                                                        {m === 'capital_only' && <>Invests {money(p.investment)} · pays out <span className="tw-text-amber-700">{money(p.payout)}</span></>}
                                                        {m === 'capital_profit' && <>Invests {money(p.investment)}{p.kept > 0 ? <> · keeps <span className="tw-text-sky-700">{money(p.kept)}</span></> : ''}</>}
                                                        {m === 'top_up' && <>From {plural(p.minUnits, 'unit')} · investor pays from <span className="tw-text-brand-700">{money(p.topUp)}</span></>}
                                                    </span>
                                                )}
                                                {p?.problem && <span className="tw-mt-auto tw-text-xs tw-text-rose-600">{p.problem}</span>}
                                            </button>
                                        );
                                    })}
                                </div>

                                <div className="tw-grid tw-gap-4 sm:tw-grid-cols-2">
                                    <Field label="Project" className="sm:tw-col-span-2">
                                        <Select value={idProjects ?? ''} onChange={(e) => setIdProjects(Number(e.target.value) || null)}>
                                            {options!.projects.length === 0 && <option value="">No project is open for new money</option>}
                                            {options!.projects.map((p) => (
                                                <option key={p.idProjects} value={p.idProjects}>
                                                    {p.projectName} · {bdtExact(p.unitInvestmentValue)}/unit · {p.duration} {p.tenure} · {p.returnRangeMin}–{p.returnRangeMax}%
                                                    {p.remainingUnits !== null ? ` · ${p.remainingUnits} left` : ''}
                                                    {p.idProjects === src.project.idProjects ? ' (same project)' : ''}
                                                </option>
                                            ))}
                                        </Select>
                                    </Field>
                                    <Field label="Units" hint={plan ? (mode === 'top_up' ? `At least ${plan.minUnits}` : `Up to ${plan.maxUnits}`) : undefined}>
                                        <div className="tw-flex tw-items-center tw-gap-2">
                                            <Button size="sm" variant="secondary" onClick={() => setUnits((u) => Math.max(1, u - 1))} aria-label="One unit less">
                                                <Minus className="tw-h-3.5 tw-w-3.5" aria-hidden />
                                            </Button>
                                            <div className="tw-w-20">
                                                <Input type="number" min={1} step={1} value={units || ''} onChange={(e) => setUnits(Math.max(0, Math.floor(Number(e.target.value) || 0)))} className="tw-text-center" aria-label="Units" />
                                            </div>
                                            <Button size="sm" variant="secondary" onClick={() => setUnits((u) => u + 1)} aria-label="One unit more">
                                                <Plus className="tw-h-3.5 tw-w-3.5" aria-hidden />
                                            </Button>
                                        </div>
                                    </Field>
                                    <Field label="Partner">
                                        <Select value={idProjectPartners ?? ''} onChange={(e) => setIdProjectPartners(Number(e.target.value) || null)} disabled={!partners || partners.length === 0}>
                                            {partners === null && <option value="">Loading partners…</option>}
                                            {partners && partners.length === 0 && <option value="">No partner has room in this project</option>}
                                            {partners?.map((p) => (
                                                <option key={p.idProjectPartners} value={p.idProjectPartners}>
                                                    {p.User?.fullName || `Partner #${p.idProjectPartners}`}
                                                    {Number(p.partnerUnitCapacity) > 0 ? ` · ${p.investorConfirmedBookingCount ?? 0}/${p.partnerUnitCapacity} taken` : ''}
                                                </option>
                                            ))}
                                        </Select>
                                    </Field>
                                    {!topUpDue && (
                                        <Field label="Starts on" hint="Usually today. The maturity is counted from this date.">
                                            <Input type="date" max={todayIso()} value={startDate} onChange={(e) => setStartDate(e.target.value || todayIso())} />
                                        </Field>
                                    )}
                                </div>

                                <div className="tw-space-y-2.5">
                                    {mode !== 'capital_only' && balance > 0 && (
                                        <label className="tw-flex tw-items-start tw-gap-2.5 tw-text-sm tw-text-slate-700">
                                            <input type="checkbox" className="tw-mt-0.5 tw-h-4 tw-w-4 tw-accent-brand-700" checked={useBalance} onChange={(e) => setUseBalance(e.target.checked)} />
                                            <span>
                                                Use the investor’s balance of <strong className="tw-font-semibold">{money(balance)}</strong> toward this investment
                                            </span>
                                        </label>
                                    )}
                                    {mode === 'capital_only' && plan && plan.payout > 0 && (
                                        <label className="tw-flex tw-items-start tw-gap-2.5 tw-text-sm tw-text-slate-700">
                                            <input type="checkbox" className="tw-mt-0.5 tw-h-4 tw-w-4 tw-accent-brand-700" checked={payoutDoneNow} onChange={(e) => setPayoutDoneNow(e.target.checked)} />
                                            <span>
                                                The {money(plan.payout)} has already been paid to the investor
                                                <span className="tw-block tw-text-xs tw-text-slate-500">Leave unticked to keep it in their balance as owed, and record the payout later.</span>
                                            </span>
                                        </label>
                                    )}
                                </div>
                            </div>

                            <PlanSummary plan={plan} problem={planProblem} topUpDue={topUpDue} startDate={startDate} maturity={newMaturity} payoutDoneNow={payoutDoneNow} />
                        </div>
                    )}

                    {/* ---------------------------------------------------- step 3 */}
                    {src?.eligible && step === 'review' && plan && (
                        <div className="tw-grid tw-gap-6 lg:tw-grid-cols-[minmax(0,1fr)_20rem]">
                            <div className="tw-space-y-4 tw-text-sm tw-leading-6 tw-text-slate-700">
                                <h3 className="tw-text-sm tw-font-semibold tw-text-slate-900">What will happen</h3>
                                <ul className="tw-list-disc tw-space-y-1.5 tw-pl-5">
                                    <li>
                                        Booking #{src.bookingRef} is closed as <strong>reinvested</strong>, with a profit of {money(profit)}.
                                    </li>
                                    <li>
                                        A new booking is created on {src.investor.fullName || 'the investor'}’s account: {plural(units, 'unit')} of {project?.projectName} ({money(plan.investment)}).
                                    </li>
                                    {topUpDue ? (
                                        <li>
                                            It waits for the <strong>top-up of {money(plan.topUp)}</strong>. The investor sees it in the app under pending proof of payment and can upload the receipt there, or you can upload it on the new booking. Confirming the payment starts the investment.
                                        </li>
                                    ) : (
                                        <li>
                                            No new money is needed, so it is <strong>confirmed now</strong> and starts on {date(startDate)} (matures {newMaturity ? date(newMaturity) : '—'}).
                                        </li>
                                    )}
                                    {plan.payout > 0 && (
                                        <li>
                                            {money(plan.payout)} is owed to the investor{payoutDoneNow ? ' and recorded as paid.' : ': it stays in their balance until you record the payout.'}
                                        </li>
                                    )}
                                    {plan.kept > 0 && <li>{money(plan.kept)} is kept in the investor’s balance, to be paid out or used toward a later investment.</li>}
                                    {plan.fromBalance > 0 && <li>{money(plan.fromBalance)} of their balance is used toward this investment.</li>}
                                </ul>
                                <label className="tw-flex tw-items-start tw-gap-2.5 tw-rounded-xl tw-border tw-border-slate-200 tw-bg-white tw-p-3">
                                    <input type="checkbox" className="tw-mt-1 tw-h-4 tw-w-4 tw-accent-brand-700" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
                                    <span>
                                        <span className="tw-font-medium tw-text-slate-900">Tell the investor</span>
                                        <span className="tw-block tw-text-xs tw-text-slate-500">
                                            {topUpDue ? 'They are told exactly how much to pay. ' : 'They are told the reinvestment is active. '}
                                            By {[src.investor.channels.sms && 'SMS', src.investor.channels.email && 'email', 'the app (if push is working)'].filter(Boolean).join(', ')}.
                                        </span>
                                    </span>
                                </label>
                                {saveError && <p className="tw-rounded-xl tw-bg-rose-50 tw-px-4 tw-py-3 tw-text-sm tw-text-rose-800" role="alert">{saveError}</p>}
                            </div>
                            <PlanSummary plan={plan} problem={planProblem} topUpDue={topUpDue} startDate={startDate} maturity={newMaturity} payoutDoneNow={payoutDoneNow} />
                        </div>
                    )}

                    {/* ---------------------------------------------------- done */}
                    {step === 'done' && result && (
                        <div className="tw-mx-auto tw-max-w-xl tw-py-4 tw-text-center">
                            <CheckCircle2 className="tw-mx-auto tw-h-10 tw-w-10 tw-text-brand-600" aria-hidden />
                            <h3 className="tw-mt-3 tw-text-lg tw-font-semibold tw-text-slate-900">Reinvestment booking #{result.newBookingRef} created</h3>
                            <div className="tw-mt-4 tw-space-y-2 tw-text-left tw-text-sm tw-leading-6 tw-text-slate-700">
                                {result.topUp > 0 ? (
                                    <p className="tw-rounded-xl tw-bg-amber-50 tw-px-4 tw-py-3 tw-text-amber-900">
                                        <strong>Next:</strong> waiting for the investor’s top-up of <strong>{money(result.topUp)}</strong>. They can upload the receipt in the app, or you can upload it on booking #{result.newBookingRef} and confirm it. The investment starts on the payment date you confirm.
                                    </p>
                                ) : (
                                    <p className="tw-rounded-xl tw-bg-emerald-50 tw-px-4 tw-py-3 tw-text-emerald-900">
                                        Active from {result.startDate ? date(result.startDate) : 'today'}{result.maturityDate ? `, matures ${date(result.maturityDate)}` : ''}.
                                    </p>
                                )}
                                {result.payout > 0 && !result.payoutDoneNow && <p>Pay {money(result.payout)} to the investor, then record it with “Record payout” on the investor’s balance.</p>}
                                {result.kept > 0 && <p>{money(result.kept)} is in the investor’s balance.</p>}
                                <p className="tw-text-slate-500">{result.notified ? 'The investor has been notified.' : 'The investor was not notified.'}</p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="tw-flex tw-items-center tw-justify-between tw-gap-3 tw-border-t tw-border-slate-100 tw-bg-slate-50/60 tw-px-6 tw-py-3">
                    <div>
                        {(step === 'plan' || step === 'review') && (
                            <Button variant="ghost" onClick={() => setStep(step === 'review' ? 'plan' : 'profit')} disabled={saving}>
                                <ArrowLeft className="tw-h-4 tw-w-4" aria-hidden /> Back
                            </Button>
                        )}
                    </div>
                    <div className="tw-flex tw-gap-2">
                        {step === 'done' && result ? (
                            <>
                                <Button variant="secondary" onClick={onClose}>
                                    Close
                                </Button>
                                <Link href={`/bookings/details/${result.newBookingId}`} className="tw-inline-flex tw-items-center tw-gap-2 tw-rounded-xl tw-bg-brand-700 tw-px-4 tw-py-2 tw-text-sm tw-font-semibold tw-text-white hover:tw-bg-brand-600" onClick={onClose}>
                                    Open booking #{result.newBookingRef} <ArrowRight className="tw-h-4 tw-w-4" aria-hidden />
                                </Link>
                            </>
                        ) : (
                            <>
                                <Button variant="secondary" onClick={onClose} disabled={saving}>
                                    Cancel
                                </Button>
                                {src?.eligible && step === 'profit' && (
                                    <Button variant="primary" onClick={() => setStep('plan')} disabled={!profitValid}>
                                        Next <ArrowRight className="tw-h-4 tw-w-4" aria-hidden />
                                    </Button>
                                )}
                                {src?.eligible && step === 'plan' && (
                                    <Button variant="primary" onClick={() => setStep('review')} disabled={Boolean(planProblem)}>
                                        Review <ArrowRight className="tw-h-4 tw-w-4" aria-hidden />
                                    </Button>
                                )}
                                {src?.eligible && step === 'review' && (
                                    <Button variant="primary" onClick={submit} disabled={saving || Boolean(planProblem)}>
                                        {saving && <Loader2 className="tw-h-4 tw-w-4 tw-animate-spin" aria-hidden />}
                                        Create reinvestment booking
                                    </Button>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </Modal>
    );
}

function PlanSummary({
    plan,
    problem,
    topUpDue,
    startDate,
    maturity,
    payoutDoneNow,
}: {
    plan: ReinvestPlan | null;
    problem: string | null;
    topUpDue: boolean;
    startDate: string;
    maturity: string | null;
    payoutDoneNow: boolean;
}) {
    return (
        <aside className="tw-h-fit tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-slate-50/60 tw-p-4 lg:tw-sticky lg:tw-top-0" aria-live="polite">
            <h3 className="tw-text-xs tw-font-semibold tw-uppercase tw-tracking-wider tw-text-slate-500">Summary</h3>
            {!plan ? (
                <p className="tw-mt-2 tw-text-sm tw-text-slate-500">Enter the profit first.</p>
            ) : (
                <dl className="tw-mt-2">
                    <Row label={`New investment (${plan.units} × ${bdtExact(plan.unitValue)})`} value={money(plan.investment)} strong />
                    <div className="tw-my-1 tw-border-t tw-border-slate-200" />
                    <Row label="From the capital" value={money(plan.fromCapital)} />
                    {plan.fromProfit > 0 && <Row label="From the profit" value={money(plan.fromProfit)} />}
                    {plan.fromBalance > 0 && <Row label="From the investor’s balance" value={money(plan.fromBalance)} />}
                    {topUpDue && <Row label="Investor pays (top-up)" value={money(plan.topUp)} tone="brand" />}
                    {plan.payout > 0 && <Row label={payoutDoneNow ? 'Paid out to the investor' : 'Owed to the investor (payout)'} value={money(plan.payout)} tone="amber" />}
                    {plan.kept > 0 && <Row label="Kept in the investor’s balance" value={money(plan.kept)} tone="sky" />}
                    <div className="tw-my-1 tw-border-t tw-border-slate-200" />
                    <Row label="Starts" value={topUpDue ? 'When the top-up is confirmed' : date(startDate)} />
                    <Row label={topUpDue ? 'Matures (if paid today)' : 'Matures'} value={maturity ? date(maturity) : '—'} />
                </dl>
            )}
            {problem && (
                <p className="tw-mt-3 tw-flex tw-gap-2 tw-rounded-xl tw-bg-amber-50 tw-px-3 tw-py-2 tw-text-xs tw-text-amber-900">
                    <TriangleAlert className="tw-mt-0.5 tw-h-3.5 tw-w-3.5 tw-shrink-0" aria-hidden />
                    {problem}
                </p>
            )}
            {plan && !problem && topUpDue && <Pill tone="amber">Waits for the top-up</Pill>}
        </aside>
    );
}
