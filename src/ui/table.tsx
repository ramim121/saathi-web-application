import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { useRouter } from 'next/router';
import { ArrowDown, ArrowUp, ChevronsUpDown, RotateCcw, SlidersHorizontal, X } from 'lucide-react';
import { cx } from './primitives';
import { SearchInput } from './controls';
import { Pager, TH } from './layout';

/**
 * The list pages' table kit: one search box, a filters panel with chips for
 * what is applied, sortable headers, rows per page and "Showing a–b of N".
 *
 * useListState keeps the search, filters, sort and page in the URL, so going
 * back from a details page (or opening a shared link) shows the same list.
 */

export const PAGE_SIZES = [10, 25, 50, 100];

export type SortDir = 'ASC' | 'DESC';
export type ListBase = { q: string; page: number; pageSize: number; orderBy: string; orderType: SortDir };

const CONTROL_KEYS = ['q', 'page', 'pageSize', 'orderBy', 'orderType'];

export function useListState<T extends ListBase>(defaults: T) {
    const router = useRouter();
    const [state, setState] = useState<T>(defaults);
    // `settled` trails `state` by 300 ms while typing, and is what to fetch with.
    const [settled, setSettled] = useState<T>(defaults);
    const [ready, setReady] = useState(false);
    const stateRef = useRef(state);
    const timer = useRef<ReturnType<typeof setTimeout>>();
    const defaultsRef = useRef(defaults);
    const keys = Object.keys(defaults) as (keyof T & string)[];

    // Start from the URL once the router knows it.
    useEffect(() => {
        if (!router.isReady || ready) return;
        const d = defaultsRef.current;
        const next = { ...d } as T;
        for (const k of keys) {
            const raw = router.query[k];
            if (typeof raw !== 'string') continue;
            if (typeof d[k] === 'number') {
                const n = Number(raw);
                if (Number.isFinite(n) && n > 0) (next as any)[k] = Math.floor(n);
            } else {
                (next as any)[k] = raw;
            }
        }
        if (!PAGE_SIZES.includes(next.pageSize)) next.pageSize = d.pageSize;
        if (next.orderType !== 'ASC' && next.orderType !== 'DESC') next.orderType = d.orderType;
        stateRef.current = next;
        setState(next);
        setSettled(next);
        setReady(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [router.isReady]);

    // Mirror what differs from the defaults into the URL (other parameters are kept).
    useEffect(() => {
        if (!ready) return;
        const d = defaultsRef.current;
        const query: Record<string, string> = {};
        for (const [k, v] of Object.entries(router.query)) {
            if (!keys.includes(k as keyof T & string) && typeof v === 'string') query[k] = v;
        }
        for (const k of keys) {
            const v = settled[k];
            if (v !== d[k] && v !== '' && v !== null && v !== undefined) query[k] = String(v);
        }
        const wanted = new URLSearchParams(query).toString();
        const current = new URLSearchParams(window.location.search).toString();
        if (wanted !== current) router.replace({ pathname: router.pathname, query }, undefined, { shallow: true, scroll: false });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [settled, ready]);

    useEffect(() => () => clearTimeout(timer.current), []);

    /** Change some fields. Anything but a page change goes back to page 1. */
    const update = (patch: Partial<T>, opts?: { typing?: boolean }) => {
        const next = { ...stateRef.current, ...patch } as T;
        if (!('page' in patch)) next.page = 1;
        stateRef.current = next;
        setState(next);
        clearTimeout(timer.current);
        if (opts?.typing) timer.current = setTimeout(() => setSettled(next), 300);
        else setSettled(next);
    };

    const reset = (keep?: Partial<T>) => {
        clearTimeout(timer.current);
        const next = { ...defaultsRef.current, ...keep } as T;
        stateRef.current = next;
        setState(next);
        setSettled(next);
    };

    /** Click a header: ascending first, then descending. */
    const sortBy = (field: string) => {
        const s = stateRef.current;
        update({ orderBy: field, orderType: s.orderBy === field && s.orderType === 'ASC' ? 'DESC' : 'ASC' } as Partial<T>);
    };

    /** value/onChange for a filter field: `<Select {...list.bind('status')}>`. Text inputs wait for typing to pause. */
    const bind = (key: keyof T & string) => ({
        value: String(state[key] ?? ''),
        onChange: (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => update({ [key]: e.target.value } as Partial<T>, { typing: e.target.tagName === 'INPUT' }),
    });

    const query = useMemo(
        () =>
            new URLSearchParams(
                Object.entries(settled)
                    .filter(([, v]) => v !== null && v !== undefined)
                    .map(([k, v]) => [k, String(v)]),
            ).toString(),
        [settled],
    );

    /** Filters (not search, sort or page) that differ from the defaults. */
    const activeFilters = keys.filter((k) => !CONTROL_KEYS.includes(k) && state[k] !== defaultsRef.current[k] && state[k] !== '').length;

    return { state, settled, ready, update, reset, sortBy, bind, query, activeFilters, defaults: defaultsRef.current };
}

/** A header cell that sorts its column. */
export function SortTH({
    label,
    field,
    sort,
    onSort,
    align = 'left',
    className,
}: {
    label: ReactNode;
    field: string;
    sort: { orderBy: string; orderType: SortDir };
    onSort: (field: string) => void;
    align?: 'left' | 'right';
    className?: string;
}) {
    const active = sort.orderBy === field;
    const Icon = !active ? ChevronsUpDown : sort.orderType === 'ASC' ? ArrowUp : ArrowDown;
    return (
        <th className={cx(TH, align === 'right' && 'tw-text-right', className)} aria-sort={active ? (sort.orderType === 'ASC' ? 'ascending' : 'descending') : 'none'}>
            <button
                type="button"
                onClick={() => onSort(field)}
                className={cx(
                    'tw-group tw-inline-flex tw-items-center tw-gap-1 tw-rounded tw-uppercase tw-tracking-wider tw-transition hover:tw-text-slate-900 focus-visible:tw-outline-none focus-visible:tw-ring-2 focus-visible:tw-ring-brand-500',
                    align === 'right' && 'tw-flex-row-reverse',
                    active ? 'tw-text-slate-900' : 'tw-text-slate-500',
                )}
                title={`Sort by ${typeof label === 'string' ? label.toLowerCase() : 'this column'}`}
            >
                {label}
                <Icon className={cx('tw-h-3.5 tw-w-3.5 tw-shrink-0', active ? 'tw-text-brand-700' : 'tw-text-slate-300 group-hover:tw-text-slate-500')} aria-hidden />
            </button>
        </th>
    );
}

export type FilterChip = { label: ReactNode; onClear: () => void };

/**
 * A chip for each filter that differs from its default. `labels` names the
 * filters to show: a string ("Location" -> "Location: Dhaka") or a function
 * returning the whole chip text from the value.
 */
export function filterChips<T extends Record<string, any>>(
    state: T,
    defaults: T,
    labels: Partial<Record<keyof T & string, string | ((value: string) => string)>>,
    update: (patch: Partial<T>) => void,
): FilterChip[] {
    return (Object.keys(labels) as (keyof T & string)[])
        .filter((k) => state[k] !== defaults[k] && state[k] !== '' && state[k] !== null && state[k] !== undefined)
        .map((k) => {
            const l = labels[k]!;
            return {
                label: typeof l === 'function' ? l(String(state[k])) : `${l}: ${String(state[k])}`,
                onClear: () => update({ [k]: defaults[k] } as Partial<T>),
            };
        });
}

/**
 * Search box, optional tabs on the left, a Filters button that opens the
 * filter fields, and a chip for each filter in force.
 */
export function ListToolbar({
    search,
    onSearch,
    placeholder = 'Search…',
    left,
    right,
    filters,
    chips = [],
    onReset,
}: {
    search: string;
    onSearch: (value: string) => void;
    placeholder?: string;
    left?: ReactNode;
    right?: ReactNode;
    filters?: ReactNode;
    chips?: FilterChip[];
    onReset?: () => void;
}) {
    const [open, setOpen] = useState(false);
    const anything = chips.length > 0 || search.trim() !== '';
    return (
        <div className="tw-flex tw-flex-col tw-gap-3">
            <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-2">
                {left && <div className="tw-mr-auto">{left}</div>}
                <SearchInput
                    className={cx('tw-min-w-[12rem] tw-flex-1', left ? 'sm:tw-max-w-sm' : 'sm:tw-max-w-md')}
                    placeholder={placeholder}
                    value={search}
                    onChange={(e) => onSearch(e.target.value)}
                    aria-label="Search"
                />
                {filters && (
                    <button
                        type="button"
                        onClick={() => setOpen((o) => !o)}
                        aria-expanded={open}
                        className={cx(
                            'tw-inline-flex tw-items-center tw-gap-2 tw-rounded-xl tw-border tw-px-3 tw-py-2 tw-text-sm tw-font-semibold tw-shadow-sm tw-transition',
                            open || chips.length ? 'tw-border-brand-200 tw-bg-brand-50 tw-text-brand-800' : 'tw-border-slate-200 tw-bg-white tw-text-slate-700 hover:tw-bg-slate-50',
                        )}
                    >
                        <SlidersHorizontal className="tw-h-4 tw-w-4" aria-hidden />
                        Filters
                        {chips.length > 0 && (
                            <span className="tw-inline-flex tw-h-5 tw-min-w-[1.25rem] tw-items-center tw-justify-center tw-rounded-full tw-bg-brand-700 tw-px-1 tw-text-[11px] tw-text-white">{chips.length}</span>
                        )}
                    </button>
                )}
                {onReset && anything && (
                    <button type="button" onClick={onReset} className="tw-inline-flex tw-items-center tw-gap-1.5 tw-rounded-xl tw-px-2.5 tw-py-2 tw-text-sm tw-font-medium tw-text-slate-500 hover:tw-bg-slate-100 hover:tw-text-slate-800">
                        <RotateCcw className="tw-h-3.5 tw-w-3.5" aria-hidden /> Reset
                    </button>
                )}
                {right && <div className="tw-ml-auto tw-flex tw-items-center tw-gap-2">{right}</div>}
            </div>
            {filters && open && <div className="tw-grid tw-grid-cols-1 tw-gap-3 tw-rounded-xl tw-bg-slate-50/80 tw-p-3 sm:tw-grid-cols-2 lg:tw-grid-cols-4">{filters}</div>}
            {chips.length > 0 && (
                <div className="tw-flex tw-flex-wrap tw-gap-1.5" aria-label="Filters in force">
                    {chips.map((c, i) => (
                        <span key={i} className="tw-inline-flex tw-items-center tw-gap-1 tw-rounded-full tw-bg-slate-100 tw-py-0.5 tw-pl-2.5 tw-pr-1 tw-text-xs tw-font-medium tw-text-slate-700">
                            {c.label}
                            <button type="button" onClick={c.onClear} className="tw-rounded-full tw-p-0.5 tw-text-slate-400 hover:tw-bg-slate-200 hover:tw-text-slate-700" aria-label="Remove this filter">
                                <X className="tw-h-3 tw-w-3" aria-hidden />
                            </button>
                        </span>
                    ))}
                </div>
            )}
        </div>
    );
}

/** "Showing 11–20 of 132", rows per page, and the pager. */
export function ListFooter({
    page,
    pageSize,
    total,
    onPage,
    onPageSize,
    loading,
    noun = 'rows',
}: {
    page: number;
    pageSize: number;
    total: number;
    onPage: (page: number) => void;
    onPageSize: (size: number) => void;
    loading?: boolean;
    noun?: string;
}) {
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
    const to = Math.min(total, page * pageSize);
    return (
        <div className="tw-flex tw-flex-wrap tw-items-center tw-justify-between tw-gap-3">
            <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-4 tw-text-xs tw-text-slate-500">
                <span className="tw-tabular-nums" aria-live="polite">
                    {loading && total === 0 ? 'Loading…' : total === 0 ? `No ${noun}` : `Showing ${from.toLocaleString('en-IN')}–${to.toLocaleString('en-IN')} of ${total.toLocaleString('en-IN')} ${noun}`}
                </span>
                <label className="tw-inline-flex tw-items-center tw-gap-2">
                    Rows per page
                    <select
                        value={pageSize}
                        onChange={(e) => onPageSize(Number(e.target.value))}
                        className="tw-cursor-pointer tw-rounded-lg tw-border tw-border-slate-200 tw-bg-white tw-py-1 tw-pl-2 tw-pr-7 tw-text-xs tw-font-medium tw-text-slate-700 focus:tw-border-brand-500 focus:tw-outline-none"
                    >
                        {PAGE_SIZES.map((n) => (
                            <option key={n} value={n}>
                                {n}
                            </option>
                        ))}
                    </select>
                </label>
            </div>
            <Pager page={Math.min(page, totalPages)} totalPages={totalPages} onChange={(p) => onPage(Math.min(Math.max(1, p), totalPages))} />
        </div>
    );
}

/**
 * Search, sort and page a list already loaded in full (the few pages whose
 * endpoint returns everything).
 */
export function useClientRows<R>(
    rows: R[],
    state: ListBase,
    opts: { text: (row: R) => string; sort: Record<string, (row: R) => string | number | null | undefined>; filter?: (row: R) => boolean },
) {
    return useMemo(() => {
        const q = state.q.trim().toLowerCase();
        let out = rows.filter((r) => (!opts.filter || opts.filter(r)) && (!q || opts.text(r).toLowerCase().includes(q)));
        const key = opts.sort[state.orderBy];
        if (key) {
            const dir = state.orderType === 'ASC' ? 1 : -1;
            out = [...out].sort((a, b) => {
                const x = key(a);
                const y = key(b);
                if (x === y) return 0;
                if (x === null || x === undefined || x === '') return 1;
                if (y === null || y === undefined || y === '') return -1;
                return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true, sensitivity: 'base' })) * dir;
            });
        }
        const start = (state.page - 1) * state.pageSize;
        return { total: out.length, pageRows: out.slice(start, start + state.pageSize) };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rows, state.q, state.orderBy, state.orderType, state.page, state.pageSize, opts.filter]);
}
