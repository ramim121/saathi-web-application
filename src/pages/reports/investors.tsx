import type { GetServerSidePropsContext } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
    useCallback,
    useDeferredValue,
    useEffect,
    useMemo,
    useRef,
    useState,
    type KeyboardEvent as ReactKeyboardEvent,
    type ReactNode,
} from 'react';
import {
    ArrowDownToLine,
    ArrowUpRight,
    CalendarClock,
    Clock3,
    Coins,
    Hourglass,
    Landmark,
    Layers,
    Mail,
    MapPin,
    Phone,
    Printer,
    RefreshCw,
    Repeat,
    Search,
    TrendingUp,
    UserRound,
    Users,
    Wallet,
    X,
    type LucideIcon,
} from 'lucide-react';
import MainLayout from '@/layouts/MainLayout';
import { requireAdminPage, redirectToLogin } from '@/utils/pageAuth';
import { loadInvestorDetail, loadInvestorList } from '@/utils/investorReport';
import type { BookingView, InvestorDetail, InvestorListItem, InvestorMetrics, LineState, NidState } from '@/utils/investorReport';
import { getRequestOptions } from '@/utils/Fetch';
import { inter } from '@/ui/font';
import { bdt, bdtCompact, bdtRange, date, daysFromToday, monthYear, pct, phoneDigits, plural, relativeDays } from '@/ui/format';
import { Avatar, Card, Kbd, Pill, Segmented, Skeleton, cx, type Tone } from '@/ui/primitives';

/**
 * Investor report — the first screen of the admin redesign.
 *
 * Pick an investor on the left (or type a name, phone, email or #id) and the
 * right shows where their money stands. Every figure comes from
 * utils/investorReport.ts, which reads the money each booking RECORDED, never
 * units x a project's current price.
 *
 * Efficiency: the list is rendered on the server, so the page is useful before
 * any request is made. An investor's detail is fetched on demand, cached for
 * the session, and prefetched when the pointer rests on a row, so moving
 * through the list is instant.
 */

type Props = {
    investors: InvestorListItem[];
    initialDetail: InvestorDetail | null;
    error: string | null;
};

type Filter = 'invested' | 'active' | 'payout' | 'pending' | 'all';
type Sort = 'active' | 'lifetime' | 'recent' | 'name';
type BookingTab = 'all' | 'active' | 'pending' | 'matured' | 'completed' | 'cancelled';
type Icon = LucideIcon;

const STATE: Record<LineState, { label: string; tone: Tone }> = {
    pending: { label: 'Pending', tone: 'amber' },
    active: { label: 'Active', tone: 'green' },
    matured: { label: 'Payout due', tone: 'sky' },
    paid_out: { label: 'Paid out', tone: 'slate' },
    reinvested: { label: 'Rolled over', tone: 'violet' },
    cancelled: { label: 'Cancelled', tone: 'rose' },
};

const NID: Record<NidState, { label: string; tone: Tone }> = {
    approved: { label: 'NID verified', tone: 'green' },
    pending: { label: 'NID in review', tone: 'amber' },
    rejected: { label: 'NID rejected', tone: 'rose' },
    none: { label: 'No NID', tone: 'slate' },
};

// Short labels: the filter shares a 300px column with the sort.
const FILTERS: Record<Filter, { label: string; test: (i: InvestorListItem) => boolean }> = {
    invested: { label: 'Has bookings', test: (i) => i.totalBookings > 0 },
    active: { label: 'Working', test: (i) => i.activeCapital > 0 },
    payout: { label: 'Payout due', test: (i) => i.awaitingPayout > 0 },
    pending: { label: 'Pending', test: (i) => i.pendingBookings > 0 },
    all: { label: 'Everyone', test: () => true },
};

const byName = (a: InvestorListItem, b: InvestorListItem) => a.name.localeCompare(b.name);
const SORTS: Record<Sort, { label: string; compare: (a: InvestorListItem, b: InvestorListItem) => number }> = {
    active: { label: 'Largest active', compare: (a, b) => b.activeCapital - a.activeCapital || b.lifetimeInvested - a.lifetimeInvested || byName(a, b) },
    lifetime: { label: 'Largest total', compare: (a, b) => b.lifetimeInvested - a.lifetimeInvested || byName(a, b) },
    recent: { label: 'Recent activity', compare: (a, b) => (b.lastActivityAt ?? '').localeCompare(a.lastActivityAt ?? '') || byName(a, b) },
    name: { label: 'Name A–Z', compare: byName },
};

/* ===================================================================== page */

export default function InvestorReportPage({ investors: initialInvestors, initialDetail, error }: Props) {
    const router = useRouter();
    const [investors, setInvestors] = useState(initialInvestors);
    const [query, setQuery] = useState('');
    const deferredQuery = useDeferredValue(query);
    const [filter, setFilter] = useState<Filter>('invested');
    const [sort, setSort] = useState<Sort>('active');
    const [selectedId, setSelectedId] = useState<number | null>(initialDetail?.investor.id ?? null);
    const [detail, setDetail] = useState<InvestorDetail | null>(initialDetail);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    /** Bumped to re-run the load for the same investor (Try again, Refresh). */
    const [attempt, setAttempt] = useState(0);

    const [cache] = useState(() => new Map<number, InvestorDetail>(initialDetail ? [[initialDetail.investor.id, initialDetail]] : []));
    const [inflight] = useState(() => new Map<number, Promise<InvestorDetail>>());
    const searchRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    const hoverTimer = useRef<number | undefined>(undefined);

    const fetchDetail = useCallback(
        (id: number): Promise<InvestorDetail> => {
            const hit = cache.get(id);
            if (hit) return Promise.resolve(hit);
            const running = inflight.get(id);
            if (running) return running;
            const request = fetch(`/api/reports/investors/${id}`, getRequestOptions())
                .then(async (res) => {
                    const body = await res.json().catch(() => ({}));
                    if (!res.ok || !body.success) throw new Error(body.message || `Request failed (${res.status})`);
                    cache.set(id, body.data as InvestorDetail);
                    return body.data as InvestorDetail;
                })
                .finally(() => inflight.delete(id));
            inflight.set(id, request);
            return request;
        },
        [cache, inflight],
    );

    // Load whichever investor is selected.
    useEffect(() => {
        if (selectedId === null) {
            setDetail(null);
            setLoadError(null);
            setLoading(false);
            return;
        }
        const hit = cache.get(selectedId);
        if (hit) {
            setDetail(hit);
            setLoadError(null);
            setLoading(false);
            return;
        }
        let live = true;
        setLoading(true);
        setLoadError(null);
        fetchDetail(selectedId)
            .then((d) => {
                if (live) {
                    setDetail(d);
                    setLoading(false);
                }
            })
            .catch((e: Error) => {
                if (live) {
                    setLoadError(e.message);
                    setLoading(false);
                }
            });
        return () => {
            live = false;
        };
    }, [selectedId, attempt, cache, fetchDetail]);

    // Keep the selection in the URL, so a report can be bookmarked or shared.
    const select = useCallback(
        (id: number | null) => {
            setSelectedId(id);
            router.replace({ pathname: router.pathname, query: id ? { id: String(id) } : {} }, undefined, { shallow: true, scroll: false });
        },
        [router],
    );

    // Back/forward through earlier selections.
    useEffect(() => {
        const fromUrl = Number(router.query.id);
        const next = Number.isInteger(fromUrl) && fromUrl > 0 ? fromUrl : null;
        setSelectedId((current) => (current === next ? current : next));
    }, [router.query.id]);

    // "/" jumps to the search box from anywhere on the page.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const t = e.target as HTMLElement | null;
            if (e.key === '/' && !(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable))) {
                e.preventDefault();
                searchRef.current?.focus();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    const counts = useMemo(() => {
        const out = {} as Record<Filter, number>;
        (Object.keys(FILTERS) as Filter[]).forEach((f) => {
            out[f] = investors.filter(FILTERS[f].test).length;
        });
        return out;
    }, [investors]);

    // A search looks through every investor, so a name can always be found.
    const visible = useMemo(() => {
        const q = deferredQuery.trim().toLowerCase();
        let list: InvestorListItem[];
        if (q) {
            const digits = phoneDigits(q);
            const idQuery = /^#?\d{1,7}$/.test(q) ? Number(q.replace('#', '')) : null;
            list = investors.filter(
                (i) =>
                    i.name.toLowerCase().includes(q) ||
                    (i.email ?? '').toLowerCase().includes(q) ||
                    (digits.length >= 3 && phoneDigits(i.phone).includes(digits)) ||
                    (idQuery !== null && i.id === idQuery),
            );
        } else {
            list = investors.filter(FILTERS[filter].test);
        }
        return [...list].sort(SORTS[sort].compare);
    }, [investors, deferredQuery, filter, sort]);

    // Keep the selected row in view when it moves by keyboard.
    useEffect(() => {
        if (selectedId === null) return;
        listRef.current?.querySelector(`[data-id="${selectedId}"]`)?.scrollIntoView({ block: 'nearest' });
    }, [selectedId]);

    const onSearchKey = (e: ReactKeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            if (!visible.length) return;
            const at = visible.findIndex((i) => i.id === selectedId);
            const next = e.key === 'ArrowDown' ? Math.min(visible.length - 1, at + 1) : Math.max(0, at <= 0 ? 0 : at - 1);
            select(visible[next].id);
        } else if (e.key === 'Enter' && visible.length) {
            select(visible[0].id);
        } else if (e.key === 'Escape') {
            setQuery('');
        }
    };

    const prefetch = (id: number) => {
        window.clearTimeout(hoverTimer.current);
        hoverTimer.current = window.setTimeout(() => {
            fetchDetail(id).catch(() => undefined);
        }, 120);
    };
    const cancelPrefetch = () => window.clearTimeout(hoverTimer.current);

    const refresh = async () => {
        setRefreshing(true);
        try {
            const res = await fetch('/api/reports/investors', getRequestOptions());
            const body = await res.json().catch(() => ({}));
            if (res.ok && body.success) {
                setInvestors(body.data as InvestorListItem[]);
                cache.clear();
                // Reloads the open investor through the normal path, errors included.
                setAttempt((a) => a + 1);
            }
        } catch {
            // The list simply stays as it was; the detail load reports its own errors.
        } finally {
            setRefreshing(false);
        }
    };

    const selected = selectedId !== null ? investors.find((i) => i.id === selectedId) ?? null : null;
    const showingDetail = selectedId !== null;

    return (
        <>
            <Head>
                <title>{detail && showingDetail ? `${detail.investor.name} · Investor report` : 'Investor report'} · Shathi admin</title>
            </Head>

            <div className={cx(inter.variable, 'ui ui-print-root tw-pb-12')}>
                {/* Header */}
                <div className="tw-mb-6 tw-flex tw-flex-wrap tw-items-end tw-justify-between tw-gap-4 print:tw-hidden">
                    <div>
                        <p className="tw-text-xs tw-font-semibold tw-uppercase tw-tracking-[0.14em] tw-text-brand-700">Reports</p>
                        <h1 className="tw-mt-1 tw-text-[26px] tw-font-semibold tw-leading-8 tw-tracking-tight tw-text-slate-900">Investor report</h1>
                        <p className="tw-mt-1 tw-max-w-xl tw-text-sm tw-text-slate-500">
                            Every investor&apos;s money in one place — what is working, what is due, and what has come back.
                        </p>
                    </div>
                    <div className="tw-flex tw-items-center tw-gap-2">
                        <button
                            type="button"
                            onClick={refresh}
                            disabled={refreshing}
                            className="tw-inline-flex tw-items-center tw-gap-2 tw-rounded-xl tw-border tw-border-slate-200 tw-bg-white tw-px-3 tw-py-2 tw-text-sm tw-font-medium tw-text-slate-700 tw-shadow-sm tw-transition hover:tw-bg-slate-50 disabled:tw-opacity-60"
                        >
                            <RefreshCw className={cx('tw-h-4 tw-w-4', refreshing && 'tw-animate-spin')} aria-hidden />
                            Refresh
                        </button>
                        {showingDetail && detail && (
                            <button
                                type="button"
                                onClick={() => window.print()}
                                className="tw-inline-flex tw-items-center tw-gap-2 tw-rounded-xl tw-bg-slate-900 tw-px-3 tw-py-2 tw-text-sm tw-font-medium tw-text-white tw-shadow-sm tw-transition hover:tw-bg-slate-800"
                            >
                                <Printer className="tw-h-4 tw-w-4" aria-hidden />
                                Print statement
                            </button>
                        )}
                    </div>
                </div>

                {/* Printed statement heading */}
                <div className="tw-mb-4 tw-hidden tw-border-b tw-border-slate-300 tw-pb-3 print:tw-block">
                    <p className="tw-text-xs tw-uppercase tw-tracking-widest tw-text-slate-500">Shathi · Investor statement</p>
                    <p className="tw-text-sm tw-text-slate-500">Generated {date(new Date().toISOString())}</p>
                </div>

                {error && (
                    <Card className="tw-mb-6 tw-border-rose-200 tw-bg-rose-50 tw-p-4 tw-text-sm tw-text-rose-800">
                        The report could not be loaded: {error}
                    </Card>
                )}

                {/* In print the list is hidden, so the grid collapses to one column —
                    otherwise the statement would land in the list's 300px track. */}
                <div className="tw-grid tw-grid-cols-1 tw-gap-6 lg:tw-grid-cols-[300px_minmax(0,1fr)] print:tw-block">
                    {/* ---------------------------------------------------- list */}
                    <aside className="print:tw-hidden">
                        <Card className="tw-flex tw-flex-col tw-overflow-hidden lg:tw-sticky lg:tw-top-4 lg:tw-h-[calc(100vh-2rem)] lg:tw-max-h-[880px]">
                            <div className="tw-border-b tw-border-slate-100 tw-p-3">
                                <label className="tw-relative tw-block">
                                    <span className="tw-sr-only">Search investors</span>
                                    <Search className="tw-pointer-events-none tw-absolute tw-left-3 tw-top-1/2 tw-h-4 tw-w-4 -tw-translate-y-1/2 tw-text-slate-400" aria-hidden />
                                    <input
                                        ref={searchRef}
                                        value={query}
                                        onChange={(e) => setQuery(e.target.value)}
                                        onKeyDown={onSearchKey}
                                        placeholder="Name, phone, email or #id"
                                        autoComplete="off"
                                        spellCheck={false}
                                        className="tw-w-full tw-rounded-xl tw-border tw-border-slate-200 tw-bg-slate-50 tw-py-2 tw-pl-9 tw-pr-9 tw-text-sm tw-text-slate-900 tw-outline-none tw-transition placeholder:tw-text-slate-400 focus:tw-border-brand-500 focus:tw-bg-white focus:tw-ring-4 focus:tw-ring-brand-500/10"
                                    />
                                    {query ? (
                                        <button
                                            type="button"
                                            onClick={() => setQuery('')}
                                            className="tw-absolute tw-right-2 tw-top-1/2 -tw-translate-y-1/2 tw-rounded-md tw-p-1 tw-text-slate-400 hover:tw-bg-slate-200/60 hover:tw-text-slate-600"
                                            aria-label="Clear search"
                                        >
                                            <X className="tw-h-3.5 tw-w-3.5" aria-hidden />
                                        </button>
                                    ) : (
                                        <span className="tw-pointer-events-none tw-absolute tw-right-2.5 tw-top-1/2 -tw-translate-y-1/2">
                                            <Kbd>/</Kbd>
                                        </span>
                                    )}
                                </label>

                                <div className="tw-mt-2.5 tw-grid tw-grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] tw-gap-2">
                                    {query ? (
                                        <p className="tw-col-span-1 tw-self-center tw-text-xs tw-text-slate-500">Searching all {investors.length}</p>
                                    ) : (
                                        <SelectBox
                                            label="Show"
                                            value={filter}
                                            onChange={(v) => setFilter(v as Filter)}
                                            options={(Object.keys(FILTERS) as Filter[]).map((f) => ({ value: f, label: `${FILTERS[f].label} · ${counts[f]}` }))}
                                        />
                                    )}
                                    <SelectBox
                                        label="Sort"
                                        value={sort}
                                        onChange={(v) => setSort(v as Sort)}
                                        options={(Object.keys(SORTS) as Sort[]).map((s) => ({ value: s, label: SORTS[s].label }))}
                                    />
                                </div>
                            </div>

                            <div ref={listRef} role="listbox" aria-label="Investors" className="tw-max-h-[55vh] tw-flex-1 tw-overflow-y-auto tw-p-1.5 lg:tw-max-h-none">
                                {visible.map((i) => (
                                    <InvestorRow
                                        key={i.id}
                                        investor={i}
                                        active={i.id === selectedId}
                                        onSelect={() => select(i.id)}
                                        onHover={() => prefetch(i.id)}
                                        onLeave={cancelPrefetch}
                                    />
                                ))}
                                {!visible.length && (
                                    <div className="tw-px-4 tw-py-10 tw-text-center">
                                        <UserRound className="tw-mx-auto tw-h-6 tw-w-6 tw-text-slate-300" aria-hidden />
                                        <p className="tw-mt-2 tw-text-sm tw-font-medium tw-text-slate-700">No investors match</p>
                                        <p className="tw-mt-1 tw-text-xs tw-text-slate-500">Try part of a name, the last digits of a phone, or #id.</p>
                                    </div>
                                )}
                            </div>

                            <div className="tw-flex tw-items-center tw-justify-between tw-border-t tw-border-slate-100 tw-px-3 tw-py-2 tw-text-[11px] tw-text-slate-400">
                                <span className="tw-tabular-nums">
                                    {visible.length} of {investors.length}
                                </span>
                                <span className="tw-hidden tw-items-center tw-gap-1 sm:tw-inline-flex">
                                    <Kbd>↑</Kbd>
                                    <Kbd>↓</Kbd> to move
                                </span>
                            </div>
                        </Card>
                    </aside>

                    {/* --------------------------------------------------- panel */}
                    <section className="tw-min-w-0" aria-live="polite">
                        {!showingDetail && <Overview investors={investors} onPick={select} />}
                        {showingDetail && loading && <PanelSkeleton name={selected?.name} />}
                        {showingDetail && !loading && loadError && (
                            <Card className="tw-p-8 tw-text-center">
                                <p className="tw-text-sm tw-font-medium tw-text-slate-900">This investor could not be loaded</p>
                                <p className="tw-mt-1 tw-text-sm tw-text-slate-500">{loadError}</p>
                                <button
                                    type="button"
                                    onClick={() => setAttempt((a) => a + 1)}
                                    className="tw-mt-4 tw-rounded-xl tw-bg-slate-900 tw-px-3 tw-py-2 tw-text-sm tw-font-medium tw-text-white"
                                >
                                    Try again
                                </button>
                            </Card>
                        )}
                        {showingDetail && !loading && !loadError && detail && <InvestorPanel key={detail.investor.id} detail={detail} />}
                    </section>
                </div>
            </div>
        </>
    );
}

InvestorReportPage.getLayout = function PageLayout(page: ReactNode) {
    return <MainLayout>{page}</MainLayout>;
};

/* ================================================================= pieces */

function SelectBox({
    label,
    value,
    onChange,
    options,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    options: { value: string; label: string }[];
}) {
    return (
        <label className="tw-block">
            <span className="tw-sr-only">{label}</span>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="tw-w-full tw-cursor-pointer tw-truncate tw-rounded-lg tw-border tw-border-slate-200 tw-bg-white tw-py-1.5 tw-pl-2 tw-pr-6 tw-text-xs tw-font-medium tw-text-slate-700 tw-outline-none focus:tw-border-brand-500 focus:tw-ring-2 focus:tw-ring-brand-500/15"
            >
                {options.map((o) => (
                    <option key={o.value} value={o.value}>
                        {o.label}
                    </option>
                ))}
            </select>
        </label>
    );
}

function InvestorRow({
    investor: i,
    active,
    onSelect,
    onHover,
    onLeave,
}: {
    investor: InvestorListItem;
    active: boolean;
    onSelect: () => void;
    onHover: () => void;
    onLeave: () => void;
}) {
    let note: ReactNode = <span className="tw-text-slate-400">no bookings</span>;
    if (i.awaitingPayout > 0) note = <span className="tw-font-medium tw-text-sky-700">payout due</span>;
    else if (i.pendingBookings > 0) note = <span className="tw-font-medium tw-text-amber-700">pending</span>;
    else if (i.activeBookings > 0) note = <span>{i.activeBookings} active</span>;
    else if (i.totalBookings > 0) note = <span className="tw-text-slate-400">closed</span>;

    return (
        <button
            type="button"
            role="option"
            aria-selected={active}
            data-id={i.id}
            onClick={onSelect}
            onMouseEnter={onHover}
            onMouseLeave={onLeave}
            className={cx(
                'tw-flex tw-w-full tw-items-center tw-gap-3 tw-rounded-xl tw-px-2.5 tw-py-2 tw-text-left tw-transition',
                'focus-visible:tw-outline-none focus-visible:tw-ring-2 focus-visible:tw-ring-brand-500',
                active ? 'tw-bg-brand-50 tw-ring-1 tw-ring-inset tw-ring-brand-600/20' : 'hover:tw-bg-slate-50',
            )}
        >
            <Avatar name={i.name} seed={i.id} size="sm" />
            <span className="tw-min-w-0 tw-flex-1">
                <span className="tw-flex tw-items-baseline tw-justify-between tw-gap-2">
                    <span className={cx('tw-truncate tw-text-sm tw-font-medium', active ? 'tw-text-brand-800' : 'tw-text-slate-900')}>{i.name}</span>
                    <span className="tw-shrink-0 tw-text-sm tw-font-semibold tw-tabular-nums tw-text-slate-900">
                        {i.activeCapital > 0 ? bdtCompact(i.activeCapital) : <span className="tw-font-normal tw-text-slate-300">—</span>}
                    </span>
                </span>
                <span className="tw-mt-0.5 tw-flex tw-items-center tw-justify-between tw-gap-2 tw-text-xs tw-text-slate-500">
                    <span className="tw-truncate">{i.phone ?? i.email ?? `#${i.id}`}</span>
                    <span className="tw-shrink-0">{note}</span>
                </span>
            </span>
        </button>
    );
}

function Stat({
    icon: IconCmp,
    label,
    value,
    hint,
    emphasis,
    accent,
}: {
    icon: Icon;
    label: string;
    value: string;
    hint?: ReactNode;
    emphasis?: boolean;
    accent?: 'sky' | 'amber';
}) {
    return (
        <div
            className={cx(
                'tw-rounded-2xl tw-border tw-p-4 tw-shadow-card print:tw-shadow-none',
                emphasis
                    ? 'tw-border-brand-700 tw-bg-gradient-to-br tw-from-brand-700 tw-to-brand-800 tw-text-white print:tw-border-slate-300 print:tw-bg-none print:tw-bg-white print:tw-text-slate-900'
                    : 'tw-border-slate-200 tw-bg-white',
            )}
        >
            <div
                className={cx(
                    'tw-flex tw-items-center tw-gap-2 tw-text-[13px] tw-font-medium',
                    emphasis ? 'tw-text-brand-100 print:tw-text-slate-500' : 'tw-text-slate-500',
                )}
            >
                <span
                    className={cx(
                        'tw-inline-flex tw-h-6 tw-w-6 tw-items-center tw-justify-center tw-rounded-lg',
                        emphasis
                            ? 'tw-bg-white/15 print:tw-bg-slate-100'
                            : accent === 'sky'
                              ? 'tw-bg-sky-50 tw-text-sky-600'
                              : accent === 'amber'
                                ? 'tw-bg-amber-50 tw-text-amber-600'
                                : 'tw-bg-slate-100 tw-text-slate-500',
                    )}
                >
                    <IconCmp className="tw-h-3.5 tw-w-3.5" aria-hidden />
                </span>
                {label}
            </div>
            <div
                className={cx(
                    'tw-mt-2.5 tw-truncate tw-text-[22px] tw-font-semibold tw-leading-7 tw-tracking-tight tw-tabular-nums',
                    emphasis ? 'tw-text-white print:tw-text-slate-900' : 'tw-text-slate-900',
                )}
            >
                {value}
            </div>
            {hint && <div className={cx('tw-mt-1 tw-text-xs', emphasis ? 'tw-text-brand-100 print:tw-text-slate-500' : 'tw-text-slate-500')}>{hint}</div>}
        </div>
    );
}

function Meta({ icon: IconCmp, children }: { icon: Icon; children: ReactNode }) {
    return (
        // max-w-full: outside a flex row (the bank line) an inline-flex box would
        // otherwise take its full text width and push the page sideways on a phone.
        <span className="tw-inline-flex tw-min-w-0 tw-max-w-full tw-items-center tw-gap-1.5">
            <IconCmp className="tw-h-3.5 tw-w-3.5 tw-shrink-0 tw-text-slate-400" aria-hidden />
            <span className="tw-truncate">{children}</span>
        </span>
    );
}

/* ---------------------------------------------------------------- overview */

function Overview({ investors, onPick }: { investors: InvestorListItem[]; onPick: (id: number) => void }) {
    const totals = useMemo(
        () =>
            investors.reduce(
                (t, i) => ({
                    active: t.active + i.activeCapital,
                    payout: t.payout + i.awaitingPayout,
                    pending: t.pending + i.pendingAmount,
                    lifetime: t.lifetime + i.lifetimeInvested,
                    working: t.working + (i.activeCapital > 0 ? 1 : 0),
                    due: t.due + (i.awaitingPayout > 0 ? 1 : 0),
                    waiting: t.waiting + (i.pendingBookings > 0 ? 1 : 0),
                    invested: t.invested + (i.lifetimeInvested > 0 ? 1 : 0),
                }),
                { active: 0, payout: 0, pending: 0, lifetime: 0, working: 0, due: 0, waiting: 0, invested: 0 },
            ),
        [investors],
    );
    const top = useMemo(() => [...investors].filter((i) => i.activeCapital > 0).sort(SORTS.active.compare).slice(0, 6), [investors]);
    const due = useMemo(() => [...investors].filter((i) => i.awaitingPayout > 0).sort((a, b) => b.awaitingPayout - a.awaitingPayout), [investors]);
    const maxTop = top[0]?.activeCapital || 1;

    return (
        <div className="tw-space-y-6">
            <div className="tw-grid tw-grid-cols-1 tw-gap-3 sm:tw-grid-cols-2 xl:tw-grid-cols-4 print:tw-grid-cols-4">
                <Stat emphasis icon={Wallet} label="Money working" value={bdt(totals.active)} hint={`${plural(totals.working, 'investor')} with active bookings`} />
                <Stat icon={Hourglass} accent="sky" label="Payout due" value={bdt(totals.payout)} hint={`${plural(totals.due, 'investor')} waiting to be paid`} />
                <Stat icon={Clock3} accent="amber" label="Pending" value={bdt(totals.pending)} hint={`awaiting confirmation · ${plural(totals.waiting, 'investor')}`} />
                <Stat icon={TrendingUp} label="Total ever invested" value={bdt(totals.lifetime)} hint={`by ${plural(totals.invested, 'investor')}, rollovers included`} />
            </div>

            <div className="tw-grid tw-grid-cols-1 tw-gap-6 xl:tw-grid-cols-2">
                <Card className="tw-p-5">
                    <h3 className="tw-text-sm tw-font-semibold tw-text-slate-900">Largest active positions</h3>
                    <p className="tw-mt-0.5 tw-text-xs tw-text-slate-500">Money working right now, by investor.</p>
                    <ul className="tw-mt-4 tw-space-y-1">
                        {top.map((i) => (
                            <li key={i.id}>
                                <button
                                    type="button"
                                    onClick={() => onPick(i.id)}
                                    className="tw-group tw-w-full tw-rounded-xl tw-px-2 tw-py-2 tw-text-left tw-transition hover:tw-bg-slate-50"
                                >
                                    <span className="tw-flex tw-items-center tw-justify-between tw-gap-3 tw-text-sm">
                                        <span className="tw-truncate tw-font-medium tw-text-slate-800 group-hover:tw-text-brand-700">{i.name}</span>
                                        <span className="tw-shrink-0 tw-font-semibold tw-tabular-nums tw-text-slate-900">{bdtCompact(i.activeCapital)}</span>
                                    </span>
                                    <span className="tw-mt-1.5 tw-block tw-h-1.5 tw-overflow-hidden tw-rounded-full tw-bg-slate-100">
                                        <span className="tw-block tw-h-full tw-rounded-full tw-bg-brand-600" style={{ width: `${Math.max(3, (i.activeCapital / maxTop) * 100)}%` }} />
                                    </span>
                                </button>
                            </li>
                        ))}
                        {!top.length && <li className="tw-py-6 tw-text-center tw-text-sm tw-text-slate-500">No active investments.</li>}
                    </ul>
                </Card>

                <Card className="tw-p-5">
                    <h3 className="tw-text-sm tw-font-semibold tw-text-slate-900">Payout due</h3>
                    <p className="tw-mt-0.5 tw-text-xs tw-text-slate-500">Matured, not yet paid out — capital plus recorded profit.</p>
                    <ul className="tw-mt-4 tw-divide-y tw-divide-slate-100">
                        {due.map((i) => (
                            <li key={i.id}>
                                <button
                                    type="button"
                                    onClick={() => onPick(i.id)}
                                    className="tw-group tw-flex tw-w-full tw-items-center tw-justify-between tw-gap-3 tw-px-1 tw-py-2.5 tw-text-left tw-text-sm"
                                >
                                    <span className="tw-flex tw-min-w-0 tw-items-center tw-gap-2.5">
                                        <Avatar name={i.name} seed={i.id} size="sm" />
                                        <span className="tw-truncate tw-font-medium tw-text-slate-800 group-hover:tw-text-brand-700">{i.name}</span>
                                    </span>
                                    <span className="tw-shrink-0 tw-font-semibold tw-tabular-nums tw-text-sky-700">{bdt(i.awaitingPayout)}</span>
                                </button>
                            </li>
                        ))}
                        {!due.length && <li className="tw-py-6 tw-text-center tw-text-sm tw-text-slate-500">Nothing is waiting to be paid.</li>}
                    </ul>
                </Card>
            </div>

            <p className="tw-flex tw-items-center tw-gap-2 tw-text-xs tw-text-slate-500 print:tw-hidden">
                <Users className="tw-h-3.5 tw-w-3.5" aria-hidden />
                Pick an investor on the left, or press <Kbd>/</Kbd> and type a name.
            </p>
        </div>
    );
}

/* ------------------------------------------------------------- the panel */

function InvestorPanel({ detail }: { detail: InvestorDetail }) {
    const { investor: inv, metrics: m, bookings } = detail;
    const nid = NID[inv.nid];

    return (
        <div className="tw-space-y-6">
            {/* Identity */}
            <Card className="tw-p-5 sm:tw-p-6">
                <div className="tw-flex tw-flex-wrap tw-items-start tw-gap-4">
                    <Avatar name={inv.name} seed={inv.id} size="lg" />
                    <div className="tw-min-w-0 tw-flex-1">
                        <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-x-2.5 tw-gap-y-1.5">
                            <h2 className="tw-truncate tw-text-xl tw-font-semibold tw-tracking-tight tw-text-slate-900">{inv.name}</h2>
                            <span className="tw-text-sm tw-tabular-nums tw-text-slate-400">#{inv.id}</span>
                            <Pill tone={nid.tone}>{nid.label}</Pill>
                            {inv.status !== 'active' && <Pill tone="rose">{inv.status.charAt(0).toUpperCase() + inv.status.slice(1)} account</Pill>}
                        </div>
                        <div className="tw-mt-2 tw-flex tw-flex-wrap tw-gap-x-5 tw-gap-y-1 tw-text-sm tw-text-slate-600">
                            {inv.phone && <Meta icon={Phone}>{inv.phone}</Meta>}
                            {inv.email && <Meta icon={Mail}>{inv.email}</Meta>}
                            {inv.location && <Meta icon={MapPin}>{inv.location}</Meta>}
                            <Meta icon={UserRound}>Joined {monthYear(inv.joinedAt)}</Meta>
                        </div>
                        <div className="tw-mt-1 tw-text-sm tw-text-slate-600">
                            {inv.bank ? (
                                <Meta icon={Landmark}>
                                    {[inv.bank.bank, inv.bank.branch].filter(Boolean).join(' · ')}
                                    {inv.bank.accountLast4 && <span className="tw-tabular-nums tw-text-slate-500"> · •••• {inv.bank.accountLast4}</span>}
                                </Meta>
                            ) : (
                                <Meta icon={Landmark}>
                                    <span className="tw-text-slate-400">No payout bank account on file</span>
                                </Meta>
                            )}
                        </div>
                    </div>
                </div>
            </Card>

            {/* Figures */}
            <div className="tw-grid tw-grid-cols-1 tw-gap-3 sm:tw-grid-cols-2 xl:tw-grid-cols-4 print:tw-grid-cols-4">
                <Stat
                    emphasis
                    icon={Wallet}
                    label="Active capital"
                    value={bdt(m.activeCapital)}
                    hint={m.activeCapital > 0 ? `+${bdtRange(m.expectedProfitMin, m.expectedProfitMax)} expected profit` : 'Nothing working right now'}
                />
                <Stat
                    icon={TrendingUp}
                    label="Total invested"
                    value={bdt(m.lifetimeInvested)}
                    // "from rollovers" = money that came INTO these bookings from
                    // matured ones. Not the same figure as "Rolled forward" below,
                    // which is money that LEFT matured bookings (some of it may sit
                    // in bookings not yet confirmed).
                    hint={m.rolledOver > 0 ? `${bdtCompact(m.newMoney)} new money · ${bdtCompact(m.rolledOver)} from rollovers` : 'all new money'}
                />
                <Stat icon={ArrowDownToLine} label="Capital paid back" value={bdt(m.paidBackCapital)} hint={`${plural(m.bookings.completed, 'completed booking')}`} />
                <Stat
                    icon={Coins}
                    label="Profit paid"
                    value={bdt(m.profitPaid)}
                    hint={m.profitReinvested > 0 ? `+${bdtCompact(m.profitReinvested)} reinvested instead` : 'disbursed to the investor'}
                />
                <Stat
                    icon={Hourglass}
                    accent={m.maturedCapital > 0 ? 'sky' : undefined}
                    label="Payout due"
                    value={bdt(m.maturedCapital + m.maturedProfit)}
                    hint={m.maturedCapital > 0 ? `${bdtCompact(m.maturedCapital)} capital + ${bdtCompact(m.maturedProfit)} profit` : 'nothing waiting'}
                />
                <Stat
                    icon={Clock3}
                    accent={m.pendingAmount > 0 ? 'amber' : undefined}
                    label="Pending"
                    value={bdt(m.pendingAmount)}
                    hint={
                        m.pendingAmount > 0
                            ? m.pendingRollover > 0
                                ? `awaiting confirmation · ${bdtCompact(m.pendingRollover)} is a rollover`
                                : `awaiting confirmation · ${plural(m.bookings.pending, 'booking')}`
                            : 'nothing awaiting confirmation'
                    }
                />
                <Stat
                    icon={Layers}
                    label="Bookings"
                    value={String(m.bookings.total)}
                    hint={`${m.bookings.active} active · ${m.bookings.completed} completed · ${plural(m.projects, 'project')}`}
                />
                <Stat
                    icon={CalendarClock}
                    accent={m.nextMaturity && daysFromToday(m.nextMaturity.date) < 0 ? 'amber' : undefined}
                    label="Next maturity"
                    value={m.nextMaturity ? date(m.nextMaturity.date) : '—'}
                    hint={
                        m.nextMaturity
                            ? `#${m.nextMaturity.ref} · ${bdtCompact(m.nextMaturity.amount)} · ${relativeDays(m.nextMaturity.date)}`
                            : 'no active bookings'
                    }
                />
            </div>

            <Composition m={m} />
            <Bookings bookings={bookings} m={m} />
        </div>
    );
}

function Composition({ m }: { m: InvestorMetrics }) {
    const rolled = Math.max(0, m.lifetimeInvested - m.activeCapital - m.maturedCapital - m.paidBackCapital);
    const parts = [
        { label: 'Working', value: m.activeCapital, bar: 'tw-bg-brand-600', dot: 'tw-bg-brand-600' },
        { label: 'Payout due', value: m.maturedCapital, bar: 'tw-bg-sky-500', dot: 'tw-bg-sky-500' },
        // Matured and moved into a newer booking (that booking's own amount is
        // counted again under whatever state it is in now).
        { label: 'Rolled forward', value: rolled, bar: 'tw-bg-violet-400', dot: 'tw-bg-violet-400' },
        { label: 'Paid back', value: m.paidBackCapital, bar: 'tw-bg-slate-300', dot: 'tw-bg-slate-300' },
    ];
    const total = m.lifetimeInvested;
    if (total <= 0) return null;

    return (
        <Card className="tw-p-5">
            <div className="tw-flex tw-flex-wrap tw-items-baseline tw-justify-between tw-gap-2">
                <h3 className="tw-text-sm tw-font-semibold tw-text-slate-900">Where the money stands</h3>
                <p className="tw-text-xs tw-text-slate-500">
                    of <span className="tw-font-medium tw-tabular-nums tw-text-slate-700">{bdt(total)}</span> invested in total
                </p>
            </div>
            <div className="tw-mt-3 tw-flex tw-h-2.5 tw-overflow-hidden tw-rounded-full tw-bg-slate-100" role="img" aria-label="Split of the money invested">
                {parts
                    .filter((p) => p.value > 0)
                    .map((p) => (
                        <span key={p.label} className={cx('tw-h-full first:tw-rounded-l-full last:tw-rounded-r-full', p.bar)} style={{ width: `${(p.value / total) * 100}%` }} />
                    ))}
            </div>
            <dl className="tw-mt-4 tw-grid tw-grid-cols-2 tw-gap-x-4 tw-gap-y-3 sm:tw-grid-cols-4">
                {parts.map((p) => (
                    <div key={p.label}>
                        <dt className="tw-flex tw-items-center tw-gap-1.5 tw-text-xs tw-text-slate-500">
                            <span className={cx('tw-h-2 tw-w-2 tw-rounded-full', p.dot)} aria-hidden />
                            {p.label}
                        </dt>
                        <dd className="tw-mt-0.5 tw-text-sm tw-font-semibold tw-tabular-nums tw-text-slate-900">
                            {bdt(p.value)} <span className="tw-font-normal tw-text-slate-400">{pct((p.value / total) * 100, 0)}</span>
                        </dd>
                    </div>
                ))}
            </dl>
        </Card>
    );
}

const TAB_TEST: Record<BookingTab, (b: BookingView) => boolean> = {
    all: () => true,
    active: (b) => b.state === 'active',
    pending: (b) => b.state === 'pending',
    matured: (b) => b.state === 'matured',
    completed: (b) => b.state === 'paid_out' || b.state === 'reinvested',
    cancelled: (b) => b.state === 'cancelled',
};

function Bookings({ bookings, m }: { bookings: BookingView[]; m: InvestorMetrics }) {
    const [tab, setTab] = useState<BookingTab>('all');
    const shown = bookings.filter(TAB_TEST[tab]);
    const tabs = (
        [
            { value: 'all', label: 'All', count: m.bookings.total },
            { value: 'active', label: 'Active', count: m.bookings.active },
            { value: 'pending', label: 'Pending', count: m.bookings.pending },
            { value: 'matured', label: 'Payout due', count: m.bookings.matured },
            { value: 'completed', label: 'Completed', count: m.bookings.completed },
            { value: 'cancelled', label: 'Cancelled', count: m.bookings.cancelled },
        ] as { value: BookingTab; label: string; count: number }[]
    ).filter((t) => t.value === 'all' || t.count > 0);

    return (
        <Card className="tw-overflow-hidden">
            <div className="tw-flex tw-flex-wrap tw-items-center tw-justify-between tw-gap-3 tw-border-b tw-border-slate-100 tw-px-5 tw-py-4">
                <div>
                    <h3 className="tw-text-sm tw-font-semibold tw-text-slate-900">Bookings</h3>
                    <p className="tw-mt-0.5 tw-text-xs tw-text-slate-500">Newest first. Amounts are what each booking recorded.</p>
                </div>
                <div className="print:tw-hidden">
                    <Segmented label="Filter bookings" options={tabs} value={tab} onChange={setTab} />
                </div>
            </div>

            {shown.length ? (
                <div className="tw-overflow-x-auto">
                    <table className="tw-w-full tw-text-sm">
                        <thead>
                            <tr className="tw-bg-slate-50/70 tw-text-left tw-text-[11px] tw-font-semibold tw-uppercase tw-tracking-wider tw-text-slate-500">
                                <th className="tw-py-2.5 tw-pl-5 tw-pr-3">Booking &amp; term</th>
                                <th className="tw-px-3 tw-py-2.5">Project</th>
                                <th className="tw-px-3 tw-py-2.5 tw-text-right">Amount</th>
                                <th className="tw-hidden tw-px-3 tw-py-2.5 tw-text-right md:tw-table-cell print:tw-table-cell">Return</th>
                                <th className="tw-py-2.5 tw-pl-3 tw-pr-5 tw-text-right">Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {shown.map((b) => (
                                <BookingRow key={b.id} b={b} />
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="tw-px-5 tw-py-12 tw-text-center">
                    <Layers className="tw-mx-auto tw-h-6 tw-w-6 tw-text-slate-300" aria-hidden />
                    <p className="tw-mt-2 tw-text-sm tw-font-medium tw-text-slate-700">{bookings.length ? 'Nothing in this view' : 'No bookings yet'}</p>
                    <p className="tw-mt-1 tw-text-xs tw-text-slate-500">
                        {bookings.length ? 'Pick another filter above.' : 'This investor has not placed a booking.'}
                    </p>
                </div>
            )}
        </Card>
    );
}

function BookingRow({ b }: { b: BookingView }) {
    const state = STATE[b.state];
    const single = b.lines.length === 1 ? b.lines[0] : null;
    const start = b.lines.reduce<string | null>((s, l) => (!s || (l.start && l.start < s) ? l.start : s), null);
    const maturity = b.lines.reduce<string | null>((s, l) => (!s || (l.maturity && l.maturity > s) ? l.maturity : s), null);
    const profit = b.lines.reduce((s, l) => s + (l.profit ?? 0), 0);
    const hasProfit = b.lines.some((l) => l.profit !== null);
    const expMin = b.lines.reduce((s, l) => s + (l.expectedProfitMin ?? 0), 0);
    const expMax = b.lines.reduce((s, l) => s + (l.expectedProfitMax ?? 0), 0);
    const rate = single ? `${pct(single.returnMinPct)}–${pct(single.returnMaxPct)}` : null;

    let term: ReactNode = null;
    if (maturity && b.state === 'active') {
        const days = daysFromToday(maturity);
        term = <span className={days < 0 ? 'tw-font-medium tw-text-amber-700' : ''}>{days < 0 ? `matured ${relativeDays(maturity)}` : `matures ${relativeDays(maturity)}`}</span>;
    }

    let ret: ReactNode = <span className="tw-text-slate-300">—</span>;
    let retNote: ReactNode = null;
    if (b.state === 'active' || b.state === 'pending') {
        ret = <span className="tw-text-emerald-700">+{bdtRange(expMin, expMax)}</span>;
        retNote = rate ? `expected · ${rate}` : 'expected';
    } else if (hasProfit && b.state !== 'cancelled') {
        ret = bdt(profit);
        retNote =
            b.state === 'matured'
                ? 'due with capital'
                : b.lines.some((l) => l.status === 'reinvested_full')
                  ? 'rolled into the next booking'
                  : 'paid';
    }

    return (
        <tr className="tw-border-t tw-border-slate-100 tw-align-top tw-transition hover:tw-bg-slate-50/60">
            <td className="tw-py-3 tw-pl-5 tw-pr-3">
                <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-x-2 tw-gap-y-0.5">
                    <Link
                        href={`/bookings/details/${b.id}`}
                        title={`Placed ${date(b.placedAt)}`}
                        className="tw-inline-flex tw-items-center tw-gap-1 tw-font-semibold tw-tabular-nums tw-text-slate-900 hover:tw-text-brand-700"
                    >
                        #{b.ref}
                        <ArrowUpRight className="tw-h-3.5 tw-w-3.5 tw-text-slate-400 print:tw-hidden" aria-hidden />
                    </Link>
                    {b.type === 'reinvestment' && (
                        <span className="tw-inline-flex tw-items-center tw-gap-1 tw-whitespace-nowrap tw-text-xs tw-font-medium tw-text-violet-700">
                            <Repeat className="tw-h-3 tw-w-3" aria-hidden />
                            {b.sourceRef && b.sourceBookingId ? (
                                <>
                                    from{' '}
                                    <Link href={`/bookings/details/${b.sourceBookingId}`} className="tw-underline tw-decoration-violet-300 tw-underline-offset-2 hover:tw-text-violet-900">
                                        #{b.sourceRef}
                                    </Link>
                                </>
                            ) : (
                                'reinvestment'
                            )}
                        </span>
                    )}
                </div>
                <div className="tw-mt-1 tw-whitespace-nowrap tw-text-xs tw-tabular-nums tw-text-slate-600">
                    {date(start)} <span className="tw-text-slate-300">→</span> {date(maturity)}
                </div>
                {term && <div className="tw-text-xs tw-text-slate-500">{term}</div>}
            </td>
            <td className="tw-px-3 tw-py-3">
                {b.lines.map((l) => (
                    <div key={l.id} className="tw-leading-5 [&:not(:first-child)]:tw-mt-1.5">
                        <div className="tw-font-medium tw-text-slate-800">{l.project.name}</div>
                        <div className="tw-whitespace-nowrap tw-text-xs tw-tabular-nums tw-text-slate-500">
                            {l.units} × {bdt(l.unitPricePaid)}
                        </div>
                    </div>
                ))}
            </td>
            <td className="tw-whitespace-nowrap tw-px-3 tw-py-3 tw-text-right tw-font-semibold tw-tabular-nums tw-text-slate-900">{bdt(b.capital)}</td>
            <td className="tw-hidden tw-whitespace-nowrap tw-px-3 tw-py-3 tw-text-right md:tw-table-cell print:tw-table-cell">
                <div className="tw-font-medium tw-tabular-nums tw-text-slate-800">{ret}</div>
                {retNote && <div className="tw-text-xs tw-text-slate-500">{retNote}</div>}
            </td>
            <td className="tw-py-3 tw-pl-3 tw-pr-5 tw-text-right">
                <Pill tone={state.tone}>{state.label}</Pill>
            </td>
        </tr>
    );
}

function PanelSkeleton({ name }: { name?: string }) {
    return (
        <div className="tw-space-y-6" aria-busy="true" aria-label={name ? `Loading ${name}` : 'Loading'}>
            <Card className="tw-flex tw-items-center tw-gap-4 tw-p-6">
                <Skeleton className="tw-h-14 tw-w-14 tw-rounded-full" />
                <div className="tw-flex-1 tw-space-y-2">
                    {name ? <p className="tw-text-xl tw-font-semibold tw-tracking-tight tw-text-slate-900">{name}</p> : <Skeleton className="tw-h-5 tw-w-48" />}
                    <Skeleton className="tw-h-4 tw-w-72" />
                </div>
            </Card>
            <div className="tw-grid tw-grid-cols-1 tw-gap-3 sm:tw-grid-cols-2 xl:tw-grid-cols-4">
                {Array.from({ length: 8 }, (_, k) => (
                    <Card key={k} className="tw-space-y-3 tw-p-4">
                        <Skeleton className="tw-h-4 tw-w-24" />
                        <Skeleton className="tw-h-6 tw-w-32" />
                        <Skeleton className="tw-h-3 tw-w-28" />
                    </Card>
                ))}
            </div>
            <Card className="tw-space-y-3 tw-p-5">
                {Array.from({ length: 4 }, (_, k) => (
                    <Skeleton key={k} className="tw-h-10 tw-w-full" />
                ))}
            </Card>
        </div>
    );
}

/* ================================================================== data */

export async function getServerSideProps(context: GetServerSidePropsContext) {
    if (!requireAdminPage(context)) return redirectToLogin;

    const id = Number(context.query.id);
    try {
        const [investors, initialDetail] = await Promise.all([
            loadInvestorList(),
            Number.isInteger(id) && id > 0 ? loadInvestorDetail(id) : Promise.resolve(null),
        ]);
        return { props: { investors, initialDetail, error: null } satisfies Props };
    } catch (error) {
        return { props: { investors: [], initialDetail: null, error: (error as Error).message } satisfies Props };
    }
}
