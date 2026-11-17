import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cx } from './primitives';

/**
 * Page structure for the redesigned screens: the header every page starts
 * with, a table shell, and a pager.
 */

export function PageHeader({
    eyebrow,
    title,
    description,
    actions,
}: {
    eyebrow?: ReactNode;
    title: ReactNode;
    description?: ReactNode;
    actions?: ReactNode;
}) {
    return (
        <div className="tw-mb-6 tw-flex tw-flex-wrap tw-items-end tw-justify-between tw-gap-4">
            <div className="tw-min-w-0">
                {eyebrow && <p className="tw-text-xs tw-font-semibold tw-uppercase tw-tracking-[0.14em] tw-text-brand-700">{eyebrow}</p>}
                <h1 className="tw-mt-1 tw-text-[26px] tw-font-semibold tw-leading-8 tw-tracking-tight tw-text-slate-900">{title}</h1>
                {description && <p className="tw-mt-1 tw-max-w-2xl tw-text-sm tw-text-slate-500">{description}</p>}
            </div>
            {actions && <div className="tw-flex tw-flex-wrap tw-items-center tw-gap-2">{actions}</div>}
        </div>
    );
}

/** A table inside a card that scrolls sideways on narrow screens. */
export function TableCard({ toolbar, footer, children, className }: { toolbar?: ReactNode; footer?: ReactNode; children: ReactNode; className?: string }) {
    return (
        <div className={cx('tw-overflow-hidden tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-shadow-card', className)}>
            {toolbar && <div className="tw-border-b tw-border-slate-100 tw-px-4 tw-py-3">{toolbar}</div>}
            <div className="tw-relative tw-overflow-x-auto">
                <table className="tw-w-full tw-text-sm">{children}</table>
            </div>
            {footer && <div className="tw-border-t tw-border-slate-100 tw-px-4 tw-py-3">{footer}</div>}
        </div>
    );
}

export const TH = 'tw-whitespace-nowrap tw-bg-slate-50/80 tw-px-4 tw-py-2.5 tw-text-left tw-text-[11px] tw-font-semibold tw-uppercase tw-tracking-wider tw-text-slate-500';
export const TD = 'tw-px-4 tw-py-3 tw-align-top';
export const TR = 'tw-border-t tw-border-slate-100 tw-transition hover:tw-bg-slate-50/60';

export function EmptyRow({ colSpan, title, hint }: { colSpan: number; title: string; hint?: string }) {
    return (
        <tr>
            <td colSpan={colSpan} className="tw-px-4 tw-py-14 tw-text-center">
                <p className="tw-text-sm tw-font-medium tw-text-slate-700">{title}</p>
                {hint && <p className="tw-mt-1 tw-text-xs tw-text-slate-500">{hint}</p>}
            </td>
        </tr>
    );
}

/** Pages to show: first, last, the current one and its neighbours, with gaps. */
function pageItems(page: number, total: number): (number | 'gap')[] {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const items: (number | 'gap')[] = [1];
    const start = Math.max(2, page - 1);
    const end = Math.min(total - 1, page + 1);
    if (start > 2) items.push('gap');
    for (let p = start; p <= end; p++) items.push(p);
    if (end < total - 1) items.push('gap');
    items.push(total);
    return items;
}

export function Pager({
    page,
    totalPages,
    onChange,
    summary,
}: {
    page: number;
    totalPages: number;
    onChange: (page: number) => void;
    summary?: ReactNode;
}) {
    const btn =
        'tw-inline-flex tw-h-8 tw-min-w-[2rem] tw-items-center tw-justify-center tw-rounded-lg tw-px-2 tw-text-sm tw-font-medium tw-tabular-nums tw-transition focus-visible:tw-outline-none focus-visible:tw-ring-2 focus-visible:tw-ring-brand-500';
    return (
        <div className="tw-flex tw-flex-wrap tw-items-center tw-justify-between tw-gap-3">
            <p className="tw-text-xs tw-text-slate-500">{summary}</p>
            {totalPages > 1 && (
                <nav className="tw-flex tw-items-center tw-gap-1" aria-label="Pages">
                    <button
                        type="button"
                        className={cx(btn, 'tw-text-slate-600 hover:tw-bg-slate-100 disabled:tw-opacity-40')}
                        onClick={() => onChange(page - 1)}
                        disabled={page <= 1}
                        aria-label="Previous page"
                    >
                        <ChevronLeft className="tw-h-4 tw-w-4" aria-hidden />
                    </button>
                    {pageItems(page, totalPages).map((p, i) =>
                        p === 'gap' ? (
                            <span key={`gap-${i}`} className="tw-px-1 tw-text-slate-400">
                                …
                            </span>
                        ) : (
                            <button
                                key={p}
                                type="button"
                                onClick={() => onChange(p)}
                                aria-current={p === page ? 'page' : undefined}
                                className={cx(btn, p === page ? 'tw-bg-brand-700 tw-text-white tw-shadow-sm' : 'tw-text-slate-700 hover:tw-bg-slate-100')}
                            >
                                {p}
                            </button>
                        ),
                    )}
                    <button
                        type="button"
                        className={cx(btn, 'tw-text-slate-600 hover:tw-bg-slate-100 disabled:tw-opacity-40')}
                        onClick={() => onChange(page + 1)}
                        disabled={page >= totalPages}
                        aria-label="Next page"
                    >
                        <ChevronRight className="tw-h-4 tw-w-4" aria-hidden />
                    </button>
                </nav>
            )}
        </div>
    );
}
