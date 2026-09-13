import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

/**
 * The breakdown behind a dashboard tile.
 *
 * One search-and-sort engine driven by a column list, rather than four
 * hand-written tables. The four breakdowns differ only in their columns, so
 * writing them separately would mean fixing every sorting or formatting bug
 * four times.
 *
 * Sorting is by a `sortValue` the column supplies, not by the rendered cell.
 * Rendered cells are strings — "BDT 1,000,000" sorts before "BDT 20,000"
 * lexically, which is exactly the sort a money column must not have.
 */

export type Column<T> = {
    key: string;
    header: string;
    /** Right-align numerics; the eye scans a column of figures by its last digit. */
    align?: 'start' | 'end';
    /** Omit to make the column unsortable (e.g. an action link). */
    sortValue?: (row: T) => number | string;
    render: (row: T) => React.ReactNode;
    /** Hidden below `lg` so a phone shows the columns that matter. */
    secondary?: boolean;
};

type Props<T> = {
    open: boolean;
    onClose: () => void;
    title: string;
    /** Rendered as a pill beside the title, e.g. "26". */
    count: string;
    countTone?: 'brand' | 'good' | 'warn' | 'alert' | 'info';
    /** Free text beside the pill, e.g. the set's total. */
    summary?: string;
    rows: T[];
    columns: Column<T>[];
    rowKey: (row: T) => string | number;
    /** Fields matched by the search box. Omit to hide the box entirely. */
    searchIn?: (row: T) => string;
    /** Column key to sort by on open. */
    initialSort?: string;
    initialDirection?: 'asc' | 'desc';
    /** Rendered as a sticky final row, e.g. a column total. */
    footer?: React.ReactNode;
    empty: string;
};

const PILL_TONE: Record<string, string> = {
    brand: 'bg-primary',
    good: 'bg-success',
    warn: 'bg-warning text-dark',
    alert: 'bg-danger',
    info: 'bg-info text-dark',
};

export function DrillModal<T>({
    open,
    onClose,
    title,
    count,
    countTone = 'brand',
    summary,
    rows,
    columns,
    rowKey,
    searchIn,
    initialSort,
    initialDirection = 'asc',
    footer,
    empty,
}: Props<T>) {
    const [query, setQuery] = useState('');
    const [sortKey, setSortKey] = useState<string | undefined>(initialSort);
    const [direction, setDirection] = useState<'asc' | 'desc'>(initialDirection);

    /*
     * Escape closes, and the body stops scrolling behind the dialog. Without
     * the second part the page underneath scrolls when the list is long, and
     * closing leaves you somewhere you never navigated to.
     */
    useEffect(() => {
        if (!open) return undefined;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey);
        document.body.classList.add('modal-open');
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.classList.remove('modal-open');
        };
    }, [open, onClose]);

    /* Reopening a tile should not inherit the last tile's search. */
    useEffect(() => {
        if (open) {
            setQuery('');
            setSortKey(initialSort);
            setDirection(initialDirection);
        }
    }, [open, initialSort, initialDirection]);

    const visible = useMemo(() => {
        const needle = query.trim().toLowerCase();
        let out = rows;
        if (needle && searchIn) {
            out = out.filter((r) => searchIn(r).toLowerCase().includes(needle));
        }
        const col = columns.find((c) => c.key === sortKey);
        if (col?.sortValue) {
            const pick = col.sortValue;
            out = [...out].sort((a, b) => {
                const av = pick(a);
                const bv = pick(b);
                const cmp =
                    typeof av === 'number' && typeof bv === 'number'
                        ? av - bv
                        : String(av).localeCompare(String(bv));
                return direction === 'asc' ? cmp : -cmp;
            });
        }
        return out;
    }, [rows, query, searchIn, columns, sortKey, direction]);

    if (!open) return null;

    const toggleSort = (col: Column<T>) => {
        if (!col.sortValue) return;
        if (sortKey === col.key) {
            setDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortKey(col.key);
            setDirection('asc');
        }
    };

    return (
        <>
            <div className="modal-backdrop fade show" onClick={onClose} />
            <div
                className="modal fade show d-block"
                role="dialog"
                aria-modal="true"
                aria-label={title}
                onClick={(e) => {
                    /* Only a click on the backdrop area closes, never one inside the panel. */
                    if (e.target === e.currentTarget) onClose();
                }}
            >
                <div className="modal-dialog modal-xl modal-dialog-scrollable modal-dialog-centered">
                    <div className="modal-content shadow-lg">
                        <div className="modal-header align-items-center gap-2">
                            <h2 className="modal-title h5 fw-bold mb-0">{title}</h2>
                            <span className={`badge rounded-pill ${PILL_TONE[countTone]}`}>{count}</span>
                            {summary && <span className="text-muted small">{summary}</span>}
                            <button
                                type="button"
                                className="btn-close ms-auto"
                                aria-label="Close"
                                onClick={onClose}
                            />
                        </div>

                        <div className="modal-body p-0">
                            {searchIn && rows.length > 0 && (
                                <div className="p-3 border-bottom bg-body-tertiary">
                                    <input
                                        type="search"
                                        className="form-control"
                                        placeholder="Search by investor or project name…"
                                        value={query}
                                        onChange={(e) => setQuery(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                            )}

                            {rows.length === 0 ? (
                                <p className="text-muted text-center py-5 mb-0">{empty}</p>
                            ) : visible.length === 0 ? (
                                <p className="text-muted text-center py-5 mb-0">
                                    Nothing matches “{query}”.
                                </p>
                            ) : (
                                <div className="table-responsive">
                                    <table className="table table-sm table-hover align-middle mb-0 drill-table">
                                        <thead>
                                            <tr>
                                                <th style={{ width: '3rem' }}>#</th>
                                                {columns.map((col) => (
                                                    <th
                                                        key={col.key}
                                                        className={[
                                                            col.align === 'end' ? 'text-end' : '',
                                                            col.secondary ? 'd-none d-lg-table-cell' : '',
                                                            col.sortValue ? 'sortable' : '',
                                                        ].join(' ')}
                                                        onClick={() => toggleSort(col)}
                                                        aria-sort={
                                                            sortKey === col.key
                                                                ? direction === 'asc'
                                                                    ? 'ascending'
                                                                    : 'descending'
                                                                : undefined
                                                        }
                                                    >
                                                        {col.header}
                                                        {col.sortValue && (
                                                            <span className="sort-mark">
                                                                {sortKey === col.key
                                                                    ? direction === 'asc'
                                                                        ? '▲'
                                                                        : '▼'
                                                                    : '⇅'}
                                                            </span>
                                                        )}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {visible.map((row, index) => (
                                                <tr key={rowKey(row)}>
                                                    <td className="text-muted">{index + 1}</td>
                                                    {columns.map((col) => (
                                                        <td
                                                            key={col.key}
                                                            className={[
                                                                col.align === 'end' ? 'text-end' : '',
                                                                col.secondary ? 'd-none d-lg-table-cell' : '',
                                                            ].join(' ')}
                                                        >
                                                            {col.render(row)}
                                                        </td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                        {footer && visible.length === rows.length && (
                                            <tfoot className="table-group-divider">{footer}</tfoot>
                                        )}
                                    </table>
                                </div>
                            )}
                        </div>

                        <div className="modal-footer py-2">
                            <span className="text-muted small me-auto">
                                {visible.length === rows.length
                                    ? `${rows.length} row${rows.length === 1 ? '' : 's'}`
                                    : `${visible.length} of ${rows.length} rows`}
                            </span>
                            <button type="button" className="btn btn-sm btn-secondary" onClick={onClose}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}

/** A booking reference that links to the row that owns it. */
export function BookingLink({ id, label }: { id: number | null; label: string | null }) {
    if (!id) return <span className="text-muted">—</span>;
    return <Link href={`/bookings/view/${id}`}>#{label || id}</Link>;
}
