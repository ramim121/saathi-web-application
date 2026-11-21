import React from 'react';
import Link from 'next/link';
import { GetServerSidePropsContext } from 'next';
import MainLayout from '@/layouts/MainLayout';
import notification from '@/notifications';
import { requireAdminPage, redirectToLogin } from '@/utils/pageAuth';
import { loadDashboard, type Dashboard } from '@/utils/dashboard';
import { DashboardView } from '@/components/dashboard/DashboardView';
import { ArrowRight, CalendarCheck2, FolderKanban, Handshake, Users, type LucideIcon } from 'lucide-react';

/**
 * Admin landing page.
 *
 * It used to render the literal text "WELCOME HOME" to anyone who reached it,
 * signed in or not. That was replaced by a grid of shortcuts, on the reasoning
 * that a figure on a landing page which disagrees with the list it links to is
 * worse than no figure at all.
 *
 * That reasoning was about *duplicated* numbers. The real objection is a
 * dashboard whose totals are computed differently from the sections beneath it
 * — so the numbers here are derived by one module, `utils/dashboard`, using the
 * same units × unit-value rule the app and website use, and each block states
 * which statuses it counts. An operator opening this page wants to know how
 * much is working, what is owed and when, and where it came from; a wall of
 * links answers none of that.
 *
 * The shortcuts are still here, at the bottom, because they were genuinely
 * useful for navigation.
 */

type Shortcut = { href: string; title: string; body: string; icon: LucideIcon };

const SHORTCUTS: Shortcut[] = [
    { href: '/bookings/list', title: 'Bookings', body: 'Confirm payments, review proof, cancel.', icon: CalendarCheck2 },
    { href: '/users', title: 'Investors', body: 'Verify NIDs, check contact details.', icon: Users },
    { href: '/projects/list', title: 'Projects', body: 'Units, pricing, partner assignment.', icon: FolderKanban },
    { href: '/partners/list', title: 'Partners', body: 'Shathi partners and their capacity.', icon: Handshake },
];

type Props = {
    dashboard: Dashboard | null;
    error: string | null;
};

export default function Home({ dashboard, error }: Props) {
    return (
        <div className="ui">
            {error && (
                <div className="tw-mb-6 tw-rounded-2xl tw-border tw-border-amber-200 tw-bg-amber-50 tw-p-4 tw-text-sm tw-text-amber-900" role="alert">
                    <strong>The dashboard could not be loaded.</strong> {error}
                    <div className="tw-mt-1 tw-text-xs tw-text-amber-800">The sections below still work — only the figures on this page are affected.</div>
                </div>
            )}

            {dashboard && <DashboardView data={dashboard} />}

            <div className="tw-mt-6 tw-grid tw-grid-cols-1 tw-gap-3 sm:tw-grid-cols-2 lg:tw-grid-cols-4">
                {SHORTCUTS.map((item) => {
                    const Icon = item.icon;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className="tw-group tw-flex tw-items-start tw-gap-3 tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-4 tw-shadow-card tw-transition hover:-tw-translate-y-px hover:tw-shadow-pop"
                        >
                            <span className="tw-inline-flex tw-h-9 tw-w-9 tw-shrink-0 tw-items-center tw-justify-center tw-rounded-xl tw-bg-brand-50 tw-text-brand-700">
                                <Icon className="tw-h-[18px] tw-w-[18px]" aria-hidden />
                            </span>
                            <span className="tw-min-w-0">
                                <span className="tw-flex tw-items-center tw-gap-1 tw-text-sm tw-font-semibold tw-text-slate-900 group-hover:tw-text-brand-700">
                                    {item.title}
                                    <ArrowRight className="tw-h-3.5 tw-w-3.5 tw-opacity-0 tw-transition group-hover:tw-opacity-100" aria-hidden />
                                </span>
                                <span className="tw-mt-0.5 tw-block tw-text-xs tw-text-slate-500">{item.body}</span>
                            </span>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}

export async function getServerSideProps(context: GetServerSidePropsContext) {
    const auth = requireAdminPage(context);
    if (!auth) return redirectToLogin;

    /**
     * Kick the notification queue.
     *
     * This ran on every request to `/` before, including from signed-out
     * visitors, which meant an unauthenticated page load could trigger SMS and
     * email sending. It is now behind the admin check.
     *
     * Deliberately not awaited: it is a background sweep, and a slow or failing
     * send should not delay or break the page. Errors are swallowed for the
     * same reason — they are logged inside the queue itself.
     */
    void Promise.resolve()
        .then(() => notification())
        .catch(() => undefined);

    /*
     * A failed dashboard query must not take the whole admin down. The page
     * renders with a warning and the section links still work, which is the
     * difference between "the figures are unavailable" and "the admin is
     * broken".
     */
    try {
        const dashboard = await loadDashboard();
        return {
            props: {
                dashboard: JSON.parse(JSON.stringify(dashboard)) as Dashboard,
                error: null,
            },
        };
    } catch (error) {
        return { props: { dashboard: null, error: (error as Error).message } };
    }
}

Home.getLayout = function getLayout(page: React.ReactNode) {
    return <MainLayout>{page}</MainLayout>;
};
