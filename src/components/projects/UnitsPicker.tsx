import React, { useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { cx } from '@/ui/primitives';
import { Input, SearchInput } from '@/ui/controls';

export type PickItem = { id: number; title: string; subtitle?: string };

/** id -> units as typed ('' until entered), for the rows that are ticked. */
export type Picked = Record<number, string>;

/**
 * Tick many rows and give each a number of units: partners for a project,
 * projects for a partner, or a copied partner set. "Units for all" fills every
 * ticked row, and a row can then be changed on its own.
 */
export function UnitsPicker({
    items,
    picked,
    onChange,
    noun,
    emptyText,
    maxHeight = 'tw-max-h-80',
}: {
    items: PickItem[];
    picked: Picked;
    onChange: (next: Picked) => void;
    noun: string;
    emptyText: string;
    maxHeight?: string;
}) {
    const [query, setQuery] = useState('');
    const [each, setEach] = useState('');
    const shown = useMemo(() => {
        const q = query.trim().toLowerCase();
        return q ? items.filter((i) => `${i.title} ${i.subtitle ?? ''}`.toLowerCase().includes(q)) : items;
    }, [items, query]);
    const count = Object.keys(picked).length;
    const allShown = shown.length > 0 && shown.every((i) => i.id in picked);

    const toggle = (id: number) => {
        const next = { ...picked };
        if (id in next) delete next[id];
        else next[id] = each;
        onChange(next);
    };
    const toggleAll = () => {
        const next = { ...picked };
        for (const item of shown) {
            if (allShown) delete next[item.id];
            else if (!(item.id in next)) next[item.id] = each;
        }
        onChange(next);
    };
    const fillAll = (value: string) => {
        setEach(value);
        const next: Picked = {};
        for (const key of Object.keys(picked)) next[Number(key)] = value;
        onChange(next);
    };

    return (
        <div className="tw-space-y-3">
            <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-2">
                <SearchInput className="tw-min-w-[12rem] tw-flex-1" placeholder={`Search ${noun}`} value={query} onChange={(e) => setQuery(e.target.value)} aria-label={`Search ${noun}`} />
                <label className="tw-inline-flex tw-items-center tw-gap-2 tw-text-xs tw-font-medium tw-text-slate-600">
                    Units for all
                    <span className="tw-block tw-w-20">
                        <Input type="number" min={1} placeholder="e.g. 50" value={each} onChange={(e) => fillAll(e.target.value)} aria-label="Units for all selected" />
                    </span>
                </label>
            </div>
            <div className="tw-flex tw-items-center tw-justify-between tw-text-xs tw-text-slate-500">
                <button type="button" onClick={toggleAll} disabled={shown.length === 0} className="tw-font-semibold tw-text-brand-700 hover:tw-underline disabled:tw-text-slate-300 disabled:tw-no-underline">
                    {allShown ? 'Clear these' : `Select ${query ? 'these' : 'all'} (${shown.length})`}
                </button>
                <span className="tw-tabular-nums">{count} selected</span>
            </div>
            <ul className={cx('tw-divide-y tw-divide-slate-100 tw-overflow-y-auto tw-rounded-xl tw-border tw-border-slate-200', maxHeight)}>
                {shown.length === 0 ? (
                    <li className="tw-px-3 tw-py-6 tw-text-center tw-text-sm tw-text-slate-500">{items.length ? 'Nothing matches that search.' : emptyText}</li>
                ) : (
                    shown.map((item) => {
                        const on = item.id in picked;
                        return (
                            <li key={item.id} className={cx('tw-flex tw-items-center tw-gap-3 tw-px-3 tw-py-2', on && 'tw-bg-brand-50/50')}>
                                <button type="button" role="checkbox" aria-checked={on} onClick={() => toggle(item.id)} className="tw-flex tw-min-w-0 tw-flex-1 tw-items-center tw-gap-3 tw-text-left">
                                    <span className={cx('tw-flex tw-h-4 tw-w-4 tw-shrink-0 tw-items-center tw-justify-center tw-rounded tw-border', on ? 'tw-border-brand-600 tw-bg-brand-600 tw-text-white' : 'tw-border-slate-300 tw-bg-white')}>
                                        {on && <Check className="tw-h-3 tw-w-3" aria-hidden />}
                                    </span>
                                    <span className="tw-min-w-0">
                                        <span className="tw-block tw-truncate tw-text-sm tw-font-medium tw-text-slate-900">{item.title}</span>
                                        {item.subtitle && <span className="tw-block tw-truncate tw-text-xs tw-text-slate-500">{item.subtitle}</span>}
                                    </span>
                                </button>
                                {on && (
                                    <span className="tw-block tw-w-20 tw-shrink-0">
                                        <Input type="number" min={1} placeholder="Units" value={picked[item.id]} onChange={(e) => onChange({ ...picked, [item.id]: e.target.value })} aria-label={`Units for ${item.title}`} />
                                    </span>
                                )}
                            </li>
                        );
                    })
                )}
            </ul>
        </div>
    );
}

/** The rows ready to send, or a message saying what is missing. */
export function readPicked(picked: Picked): { rows: { id: number; units: number }[]; problem: string | null } {
    const rows = Object.entries(picked).map(([id, value]) => ({ id: Number(id), units: Number(value) }));
    if (rows.some((r) => !Number.isInteger(r.units) || r.units < 1)) return { rows, problem: 'Enter whole units (1 or more) for every selected row.' };
    return { rows, problem: null };
}
