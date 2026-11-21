import React from 'react';
import { Pill, cx } from '@/ui/primitives';
import { CAPACITY_LABEL, CAPACITY_TONE, type CapacityLevel } from '@/utils/partnerCapacityShared';

const BAR: Record<CapacityLevel, string> = {
    ok: 'tw-bg-brand-600',
    nearing: 'tw-bg-amber-500',
    critical: 'tw-bg-rose-500',
    full: 'tw-bg-rose-600',
    no_partners: 'tw-bg-rose-500',
    no_limit: 'tw-bg-sky-500',
    closed: 'tw-bg-slate-400',
};

export function CapacityPill({ level }: { level: CapacityLevel }) {
    return <Pill tone={CAPACITY_TONE[level]}>{CAPACITY_LABEL[level]}</Pill>;
}

/**
 * Paid and reserved units against a limit. Reserved shows lighter, because a
 * booking awaiting payment holds room but may still fall through.
 */
export function CapacityBar({
    confirmed,
    pending,
    limit,
    level = 'ok',
    className,
}: {
    confirmed: number;
    pending: number;
    limit: number | null;
    level?: CapacityLevel;
    className?: string;
}) {
    const paid = limit ? Math.min(100, (confirmed / limit) * 100) : 0;
    const held = limit ? Math.min(100 - paid, (pending / limit) * 100) : 0;
    return (
        <span
            className={cx('tw-flex tw-h-1.5 tw-w-full tw-overflow-hidden tw-rounded-full tw-bg-slate-100', className)}
            role="img"
            aria-label={limit ? `${confirmed} paid and ${pending} awaiting payment of ${limit} units` : `${confirmed} paid and ${pending} awaiting payment, no limit`}
        >
            <span className={cx('tw-block tw-h-full', BAR[level])} style={{ width: `${paid}%` }} />
            <span className={cx('tw-block tw-h-full tw-opacity-40', BAR[level])} style={{ width: `${held}%` }} />
        </span>
    );
}
