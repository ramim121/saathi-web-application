import { useState, type ReactNode } from 'react';
import { initials } from './format';

/**
 * Small building blocks for the redesigned screens. Tailwind only (prefixed
 * `tw-`); render them inside an element with the `ui` class.
 */

export const cx = (...classes: (string | false | null | undefined)[]) => classes.filter(Boolean).join(' ');

export type Tone = 'green' | 'amber' | 'sky' | 'slate' | 'violet' | 'rose';

const PILL: Record<Tone, string> = {
    green: 'tw-bg-emerald-50 tw-text-emerald-700 tw-ring-emerald-600/20',
    amber: 'tw-bg-amber-50 tw-text-amber-800 tw-ring-amber-600/25',
    sky: 'tw-bg-sky-50 tw-text-sky-700 tw-ring-sky-600/20',
    slate: 'tw-bg-slate-100 tw-text-slate-600 tw-ring-slate-500/20',
    violet: 'tw-bg-violet-50 tw-text-violet-700 tw-ring-violet-600/20',
    rose: 'tw-bg-rose-50 tw-text-rose-700 tw-ring-rose-600/20',
};

const DOT: Record<Tone, string> = {
    green: 'tw-bg-emerald-500',
    amber: 'tw-bg-amber-500',
    sky: 'tw-bg-sky-500',
    slate: 'tw-bg-slate-400',
    violet: 'tw-bg-violet-500',
    rose: 'tw-bg-rose-500',
};

export function Pill({ tone, children, dot = true }: { tone: Tone; children: ReactNode; dot?: boolean }) {
    return (
        <span
            className={cx(
                'tw-inline-flex tw-items-center tw-gap-1.5 tw-whitespace-nowrap tw-rounded-full tw-px-2 tw-py-0.5 tw-text-xs tw-font-medium tw-ring-1 tw-ring-inset',
                PILL[tone],
            )}
        >
            {dot && <span className={cx('tw-h-1.5 tw-w-1.5 tw-rounded-full', DOT[tone])} aria-hidden />}
            {children}
        </span>
    );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
    return (
        <div className={cx('tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-shadow-card print:tw-shadow-none', className)}>
            {children}
        </div>
    );
}

export function Skeleton({ className }: { className?: string }) {
    return <div className={cx('tw-animate-pulse tw-rounded-md tw-bg-slate-200/70', className)} aria-hidden />;
}

const AVATAR_TONES = [
    'tw-bg-emerald-100 tw-text-emerald-800',
    'tw-bg-sky-100 tw-text-sky-800',
    'tw-bg-violet-100 tw-text-violet-800',
    'tw-bg-amber-100 tw-text-amber-800',
    'tw-bg-rose-100 tw-text-rose-800',
    'tw-bg-teal-100 tw-text-teal-800',
];

export function Avatar({ name, seed, size = 'md' }: { name: string; seed: number; size?: 'sm' | 'md' | 'lg' }) {
    const dims = size === 'lg' ? 'tw-h-14 tw-w-14 tw-text-lg' : size === 'sm' ? 'tw-h-8 tw-w-8 tw-text-xs' : 'tw-h-10 tw-w-10 tw-text-sm';
    return (
        <span
            className={cx(
                'tw-inline-flex tw-shrink-0 tw-select-none tw-items-center tw-justify-center tw-rounded-full tw-font-semibold',
                dims,
                AVATAR_TONES[Math.abs(seed) % AVATAR_TONES.length],
            )}
            aria-hidden
        >
            {initials(name)}
        </span>
    );
}

export function Segmented<T extends string>({
    options,
    value,
    onChange,
    label,
}: {
    options: { value: T; label: string; count?: number }[];
    value: T;
    onChange: (value: T) => void;
    label: string;
}) {
    return (
        <div role="tablist" aria-label={label} className="tw-flex tw-flex-wrap tw-gap-1 tw-rounded-xl tw-bg-slate-100 tw-p-1">
            {options.map((o) => {
                const active = o.value === value;
                return (
                    <button
                        key={o.value}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => onChange(o.value)}
                        className={cx(
                            'tw-inline-flex tw-items-center tw-gap-1.5 tw-rounded-lg tw-px-2.5 tw-py-1 tw-text-xs tw-font-medium tw-transition',
                            'focus-visible:tw-outline-none focus-visible:tw-ring-2 focus-visible:tw-ring-brand-500',
                            active ? 'tw-bg-white tw-text-slate-900 tw-shadow-sm' : 'tw-text-slate-600 hover:tw-text-slate-900',
                        )}
                    >
                        {o.label}
                        {o.count !== undefined && (
                            <span className={cx('tw-tabular-nums', active ? 'tw-text-slate-500' : 'tw-text-slate-400')}>{o.count}</span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}

/**
 * An image that shows `fallback` instead of the browser's broken-image icon
 * when there is no source or it fails to load (a missing S3 object, or a
 * bucket the browser blocks).
 */
export function SafeImg({ src, alt = '', className, fallback = null }: { src?: string | null; alt?: string; className?: string; fallback?: ReactNode }) {
    const [failed, setFailed] = useState(false);
    if (!src || failed) return <>{fallback}</>;
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} className={className} loading="lazy" onError={() => setFailed(true)} />;
}

export function Kbd({ children }: { children: ReactNode }) {
    return (
        <kbd className="tw-rounded tw-border tw-border-slate-200 tw-bg-slate-50 tw-px-1.5 tw-py-0.5 tw-font-sans tw-text-[10px] tw-font-medium tw-text-slate-500">
            {children}
        </kbd>
    );
}
