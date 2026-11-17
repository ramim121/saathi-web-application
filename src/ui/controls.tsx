import {
    forwardRef,
    type ButtonHTMLAttributes,
    type InputHTMLAttributes,
    type ReactNode,
    type SelectHTMLAttributes,
    type TextareaHTMLAttributes,
} from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { cx } from './primitives';

/**
 * Form controls and buttons for the redesigned screens. Thin wrappers around
 * the native elements: every prop (name, value, onChange, required…) passes
 * straight through, so a page's handlers work unchanged when its markup moves
 * from react-bootstrap to these.
 */

const FIELD =
    'tw-w-full tw-rounded-xl tw-border tw-border-slate-200 tw-bg-white tw-px-3 tw-py-2 tw-text-sm tw-text-slate-900 tw-shadow-sm tw-outline-none tw-transition ' +
    'placeholder:tw-text-slate-400 hover:tw-border-slate-300 focus:tw-border-brand-500 focus:tw-ring-4 focus:tw-ring-brand-500/10 disabled:tw-cursor-not-allowed disabled:tw-bg-slate-50 disabled:tw-text-slate-500';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cx(FIELD, className)} {...props} />;
});

export const SearchInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function SearchInput({ className, ...props }, ref) {
    return (
        <span className={cx('tw-relative tw-block', className)}>
            <Search className="tw-pointer-events-none tw-absolute tw-left-3 tw-top-1/2 tw-h-4 tw-w-4 -tw-translate-y-1/2 tw-text-slate-400" aria-hidden />
            <input ref={ref} type="search" className={cx(FIELD, 'tw-pl-9')} {...props} />
        </span>
    );
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...props }, ref) {
    return (
        <select ref={ref} className={cx(FIELD, 'tw-cursor-pointer tw-pr-8', className)} {...props}>
            {children}
        </select>
    );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, rows = 4, ...props }, ref) {
    return <textarea ref={ref} rows={rows} className={cx(FIELD, 'tw-resize-y', className)} {...props} />;
});

/** A native file picker whose button matches the rest of the form. */
export const FileInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function FileInput({ className, ...props }, ref) {
    return (
        <input
            ref={ref}
            type="file"
            className={cx(
                'tw-block tw-w-full tw-cursor-pointer tw-rounded-xl tw-border tw-border-dashed tw-border-slate-300 tw-bg-slate-50/60 tw-p-1.5 tw-text-sm tw-text-slate-600 tw-transition hover:tw-border-slate-400',
                'file:tw-mr-3 file:tw-cursor-pointer file:tw-rounded-lg file:tw-border-0 file:tw-bg-white file:tw-px-3 file:tw-py-1.5 file:tw-text-sm file:tw-font-semibold file:tw-text-slate-700 file:tw-shadow-sm hover:file:tw-bg-slate-100',
                'focus:tw-outline-none focus-visible:tw-ring-4 focus-visible:tw-ring-brand-500/10',
                className,
            )}
            {...props}
        />
    );
});

/** The red asterisk after a required field's label. */
export function Required() {
    return (
        <span className="tw-ml-0.5 tw-text-rose-500" aria-hidden>
            *
        </span>
    );
}

/** Label above a control, with an optional hint underneath. */
export function Field({ label, hint, children, className }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
    return (
        <label className={cx('tw-block', className)}>
            <span className="tw-mb-1.5 tw-block tw-text-xs tw-font-medium tw-text-slate-600">{label}</span>
            {children}
            {hint && <span className="tw-mt-1 tw-block tw-text-xs tw-text-slate-500">{hint}</span>}
        </label>
    );
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-outline' | 'success';
type Size = 'sm' | 'md';

const VARIANT: Record<Variant, string> = {
    primary: 'tw-bg-brand-700 tw-text-white tw-shadow-sm hover:tw-bg-brand-600 focus-visible:tw-ring-brand-500/30',
    secondary: 'tw-border tw-border-slate-200 tw-bg-white tw-text-slate-700 tw-shadow-sm hover:tw-bg-slate-50 hover:tw-text-slate-900 focus-visible:tw-ring-slate-400/30',
    ghost: 'tw-text-slate-600 hover:tw-bg-slate-100 hover:tw-text-slate-900 focus-visible:tw-ring-slate-400/30',
    danger: 'tw-bg-rose-600 tw-text-white tw-shadow-sm hover:tw-bg-rose-500 focus-visible:tw-ring-rose-500/30',
    'danger-outline': 'tw-border tw-border-rose-200 tw-bg-white tw-text-rose-700 tw-shadow-sm hover:tw-bg-rose-50 focus-visible:tw-ring-rose-500/30',
    success: 'tw-bg-emerald-600 tw-text-white tw-shadow-sm hover:tw-bg-emerald-500 focus-visible:tw-ring-emerald-500/30',
};

const SIZE: Record<Size, string> = {
    sm: 'tw-gap-1.5 tw-rounded-lg tw-px-2.5 tw-py-1.5 tw-text-xs',
    md: 'tw-gap-2 tw-rounded-xl tw-px-3.5 tw-py-2 tw-text-sm',
};

export function buttonClass(variant: Variant = 'secondary', size: Size = 'md', className?: string) {
    return cx(
        'tw-inline-flex tw-items-center tw-justify-center tw-whitespace-nowrap tw-font-semibold tw-transition focus-visible:tw-outline-none focus-visible:tw-ring-4 disabled:tw-cursor-not-allowed disabled:tw-opacity-60',
        VARIANT[variant],
        SIZE[size],
        className,
    );
}

export function Button({
    variant = 'secondary',
    size = 'md',
    className,
    type = 'button',
    ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
    // eslint-disable-next-line react/button-has-type
    return <button type={type} className={buttonClass(variant, size, className)} {...props} />;
}

export function LinkButton({
    href,
    variant = 'secondary',
    size = 'md',
    className,
    children,
}: {
    href: string;
    variant?: Variant;
    size?: Size;
    className?: string;
    children: ReactNode;
}) {
    return (
        <Link href={href} className={buttonClass(variant, size, className)}>
            {children}
        </Link>
    );
}
