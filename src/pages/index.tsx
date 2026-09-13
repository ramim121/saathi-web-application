import React from 'react';
import Link from 'next/link';
import { GetServerSidePropsContext } from 'next';
import MainLayout from '@/layouts/MainLayout';
import notification from '@/notifications';
import { requireAdminPage, redirectToLogin } from '@/utils/pageAuth';
import { loadDashboard, type Dashboard } from '@/utils/dashboard';
import { loadDashboardDetail, type DashboardDetail } from '@/utils/dashboardDetail';
import { DashboardView } from '@/components/dashboard/DashboardView';

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

type Shortcut = { href: string; title: string; body: string };

const SHORTCUTS: Shortcut[] = [
    { href: '/bookings/list', title: 'Bookings', body: 'Confirm payments, review proof, cancel.' },
    { href: '/users', title: 'Investors', body: 'Verify NIDs, check contact details.' },
    { href: '/projects/list', title: 'Projects', body: 'Units, pricing, partner assignment.' },
    { href: '/partners/list', title: 'Partners', body: 'Shathi partners and their capacity.' },
];

type Props = {
    dashboard: Dashboard | null;
    detail: DashboardDetail | null;
    error: string | null;
};

export default function Home({ dashboard, detail, error }: Props) {
    return (
        <div className="container-fluid py-4">
            {error && (
                <div className="alert alert-warning" role="alert">
                    <strong>The dashboard could not be loaded.</strong> {error}
                    <div className="small mt-1">
                        The sections below still work — only the figures on this page are affected.
                    </div>
                </div>
            )}

            {dashboard && detail && <DashboardView data={dashboard} detail={detail} />}

            <div className="row g-3 mt-1">
                {SHORTCUTS.map((item) => (
                    <div className="col-12 col-sm-6 col-lg-3" key={item.href}>
                        <Link href={item.href} className="text-decoration-none">
                            <div className="card h-100">
                                <div className="card-body py-3">
                                    <div className="fw-bold text-dark">{item.title}</div>
                                    <div className="text-muted" style={{ fontSize: '0.8rem' }}>
                                        {item.body}
                                    </div>
                                </div>
                            </div>
                        </Link>
                    </div>
                ))}
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
        /*
         * Loaded together: the tiles and their breakdowns must come from the
         * same read of the database. Fetching the detail on click would let a
         * tile say 26 while the list it opens holds 27.
         */
        const [dashboard, detail] = await Promise.all([loadDashboard(), loadDashboardDetail()]);
        return {
            props: {
                dashboard: JSON.parse(JSON.stringify(dashboard)) as Dashboard,
                detail: JSON.parse(JSON.stringify(detail)) as DashboardDetail,
                error: null,
            },
        };
    } catch (error) {
        return { props: { dashboard: null, detail: null, error: (error as Error).message } };
    }
}

Home.getLayout = function getLayout(page: React.ReactNode) {
    return <MainLayout>{page}</MainLayout>;
};
