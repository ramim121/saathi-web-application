import { useEffect, useState, type ReactNode } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ChevronDown, LogOut, Menu, X } from 'lucide-react';
import { NAV, currentItem, isActive, type NavGroup } from './nav';
import { getCookie } from '@/utils/GetCookie';
import { getRequestOptions } from '@/utils/Fetch';
import { initials } from '@/ui/format';
import { cx } from '@/ui/primitives';

/**
 * The admin's frame: a navy sidebar with every section, a slim top bar with the
 * page title and who is signed in, and the page itself.
 *
 * Only the chrome carries the `ui` class (the scoped reset for redesigned
 * screens). The page area deliberately does not, so Bootstrap pages render
 * inside the frame exactly as they were built; a redesigned page opts in by
 * putting `ui` on its own root.
 *
 * On narrow screens the sidebar becomes a drawer behind the menu button.
 */

type Me = { fullName?: string | null; email?: string | null };

function SidebarGroup({ group, pathname, onNavigate }: { group: NavGroup; pathname: string; onNavigate: () => void }) {
    const holdsCurrent = group.items.some((i) => isActive(i, pathname));
    const [open, setOpen] = useState(!group.collapsible || holdsCurrent);
    useEffect(() => {
        if (holdsCurrent) setOpen(true);
    }, [holdsCurrent]);

    return (
        <div className="tw-mt-5 first:tw-mt-2">
            {group.collapsible ? (
                <button
                    type="button"
                    onClick={() => setOpen((o) => !o)}
                    aria-expanded={open}
                    className="tw-flex tw-w-full tw-items-center tw-justify-between tw-rounded-md tw-px-3 tw-py-1 tw-text-[11px] tw-font-semibold tw-uppercase tw-tracking-[0.12em] tw-text-white/45 hover:tw-text-white/70"
                >
                    {group.label}
                    <ChevronDown className={cx('tw-h-3.5 tw-w-3.5 tw-transition', open && 'tw-rotate-180')} aria-hidden />
                </button>
            ) : (
                <p className="tw-px-3 tw-py-1 tw-text-[11px] tw-font-semibold tw-uppercase tw-tracking-[0.12em] tw-text-white/45">{group.label}</p>
            )}
            {open && (
                <ul className="tw-mt-1 tw-space-y-0.5">
                    {group.items.map((item) => {
                        const active = isActive(item, pathname);
                        const Icon = item.icon;
                        return (
                            <li key={item.href}>
                                <Link
                                    href={item.href}
                                    onClick={onNavigate}
                                    aria-current={active ? 'page' : undefined}
                                    className={cx(
                                        'tw-group tw-relative tw-flex tw-items-center tw-gap-3 tw-rounded-lg tw-px-3 tw-py-2 tw-text-[13.5px] tw-font-medium tw-transition',
                                        'focus-visible:tw-outline-none focus-visible:tw-ring-2 focus-visible:tw-ring-emerald-400/60',
                                        active ? 'tw-bg-white/[0.09] tw-text-white' : 'tw-text-white/70 hover:tw-bg-white/[0.05] hover:tw-text-white',
                                    )}
                                >
                                    {active && <span className="tw-absolute tw-inset-y-1.5 tw-left-0 tw-w-[3px] tw-rounded-full tw-bg-emerald-400" aria-hidden />}
                                    <Icon className={cx('tw-h-[17px] tw-w-[17px] tw-shrink-0', active ? 'tw-text-emerald-300' : 'tw-text-white/45 group-hover:tw-text-white/70')} aria-hidden />
                                    <span className="tw-truncate">{item.label}</span>
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}

function Sidebar({ pathname, onNavigate }: { pathname: string; onNavigate: () => void }) {
    return (
        <div className="tw-flex tw-h-full tw-flex-col tw-bg-[#0a1033] tw-bg-gradient-to-b tw-from-[#0b1238] tw-to-[#070b26]">
            <div className="tw-flex tw-h-16 tw-shrink-0 tw-items-center tw-px-5">
                <Link href="/" onClick={onNavigate} className="tw-flex tw-items-center" aria-label="Shathi admin, dashboard">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/assets/images/logo-header.png" alt="Shathi" className="tw-h-9 tw-w-auto" />
                </Link>
                <span className="tw-ml-2.5 tw-rounded-md tw-bg-white/10 tw-px-1.5 tw-py-0.5 tw-text-[10px] tw-font-semibold tw-uppercase tw-tracking-wider tw-text-white/60">
                    Admin
                </span>
            </div>
            <nav className="tw-flex-1 tw-overflow-y-auto tw-px-3 tw-pb-6 [scrollbar-width:thin]" aria-label="Admin sections">
                {NAV.map((g) => (
                    <SidebarGroup key={g.label} group={g} pathname={pathname} onNavigate={onNavigate} />
                ))}
            </nav>
            <div className="tw-border-t tw-border-white/10 tw-p-3">
                <Link
                    href="/logout"
                    onClick={onNavigate}
                    className="tw-flex tw-items-center tw-gap-3 tw-rounded-lg tw-px-3 tw-py-2 tw-text-[13.5px] tw-font-medium tw-text-white/70 tw-transition hover:tw-bg-white/[0.05] hover:tw-text-white"
                >
                    <LogOut className="tw-h-[17px] tw-w-[17px] tw-text-white/45" aria-hidden />
                    Sign out
                </Link>
            </div>
        </div>
    );
}

export default function AppShell({ children }: { children: ReactNode }) {
    const router = useRouter();
    const [drawer, setDrawer] = useState(false);
    const [me, setMe] = useState<Me | null>(null);
    const here = currentItem(router.pathname);

    // Who is signed in, for the top bar. One request per page load.
    useEffect(() => {
        if (!getCookie('saathi-token')) return;
        let live = true;
        fetch('/api/user', getRequestOptions())
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => {
                if (live && d?.user) setMe({ fullName: d.user.fullName, email: d.user.email });
            })
            .catch(() => undefined);
        return () => {
            live = false;
        };
    }, []);

    // The drawer closes when a page changes, and Escape closes it.
    useEffect(() => {
        const close = () => setDrawer(false);
        router.events.on('routeChangeStart', close);
        return () => router.events.off('routeChangeStart', close);
    }, [router.events]);
    useEffect(() => {
        if (!drawer) return;
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawer(false);
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [drawer]);

    const name = me?.fullName?.trim() || me?.email || 'Admin';

    return (
        <>
            <Head>
                <title>{here ? `${here.item.label} · Shathi admin` : 'Shathi admin'}</title>
                <meta content="width=device-width, initial-scale=1" name="viewport" />
                <meta name="description" content="Shathi investment management — admin" />
            </Head>

            <div className="tw-min-h-screen tw-bg-slate-50">
                {/* Sidebar: fixed on large screens */}
                <aside className="ui tw-fixed tw-inset-y-0 tw-left-0 tw-z-40 tw-hidden tw-w-64 lg:tw-block print:tw-hidden">
                    <Sidebar pathname={router.pathname} onNavigate={() => undefined} />
                </aside>

                {/* Sidebar: drawer on small screens */}
                {drawer && (
                    <div className="ui tw-fixed tw-inset-0 tw-z-50 lg:tw-hidden print:tw-hidden" role="dialog" aria-modal="true" aria-label="Navigation">
                        <button type="button" className="tw-absolute tw-inset-0 tw-bg-slate-900/50 tw-backdrop-blur-[2px]" aria-label="Close navigation" onClick={() => setDrawer(false)} />
                        <div className="tw-relative tw-h-full tw-w-72 tw-max-w-[85vw] tw-shadow-pop">
                            <Sidebar pathname={router.pathname} onNavigate={() => setDrawer(false)} />
                            <button
                                type="button"
                                onClick={() => setDrawer(false)}
                                className="tw-absolute tw-right-3 tw-top-4 tw-rounded-lg tw-p-1.5 tw-text-white/70 hover:tw-bg-white/10 hover:tw-text-white"
                                aria-label="Close navigation"
                            >
                                <X className="tw-h-5 tw-w-5" aria-hidden />
                            </button>
                        </div>
                    </div>
                )}

                <div className="lg:tw-pl-64">
                    {/* Top bar */}
                    <header className="ui tw-sticky tw-top-0 tw-z-30 tw-flex tw-h-16 tw-items-center tw-gap-3 tw-border-b tw-border-slate-200/80 tw-bg-white/85 tw-px-4 tw-backdrop-blur sm:tw-px-6 lg:tw-px-8 print:tw-hidden">
                        <button
                            type="button"
                            onClick={() => setDrawer(true)}
                            className="-tw-ml-1 tw-rounded-lg tw-p-2 tw-text-slate-600 hover:tw-bg-slate-100 lg:tw-hidden"
                            aria-label="Open navigation"
                        >
                            <Menu className="tw-h-5 tw-w-5" aria-hidden />
                        </button>
                        <div className="tw-min-w-0 tw-flex-1">
                            {here ? (
                                <p className="tw-truncate tw-text-sm tw-text-slate-500">
                                    <span className="tw-hidden sm:tw-inline">{here.group.label}</span>
                                    <span className="tw-mx-2 tw-hidden tw-text-slate-300 sm:tw-inline">/</span>
                                    <span className="tw-font-semibold tw-text-slate-900">{here.item.label}</span>
                                </p>
                            ) : (
                                <p className="tw-text-sm tw-font-semibold tw-text-slate-900">Shathi admin</p>
                            )}
                        </div>
                        <Link
                            href="/account"
                            title="Your account"
                            aria-label={`Your account (${name})`}
                            className="-tw-mr-1 tw-flex tw-items-center tw-gap-2.5 tw-rounded-xl tw-py-1 tw-pl-2 tw-pr-1 tw-transition hover:tw-bg-slate-100 focus-visible:tw-outline-none focus-visible:tw-ring-2 focus-visible:tw-ring-brand-500"
                        >
                            <span className="tw-hidden tw-text-right tw-leading-tight sm:tw-block">
                                <span className="tw-block tw-text-[13px] tw-font-medium tw-text-slate-900">{name}</span>
                                {me?.email && me.fullName && <span className="tw-block tw-text-[11px] tw-text-slate-500">{me.email}</span>}
                            </span>
                            <span className="tw-inline-flex tw-h-9 tw-w-9 tw-items-center tw-justify-center tw-rounded-full tw-bg-brand-100 tw-text-xs tw-font-semibold tw-text-brand-800" aria-hidden>
                                {initials(name)}
                            </span>
                        </Link>
                    </header>

                    <main id="main-content" className="tw-mx-auto tw-w-full tw-max-w-[1440px] tw-px-4 tw-py-6 sm:tw-px-6 lg:tw-px-8 print:tw-p-0">
                        {children}
                    </main>

                    <footer className="ui tw-mx-auto tw-max-w-[1440px] tw-px-4 tw-pb-8 tw-pt-2 tw-text-xs tw-text-slate-400 sm:tw-px-6 lg:tw-px-8 print:tw-hidden">
                        Shathi admin · DigiGram Ventures · Support: Ramim S. Hossain, 01966662633, ramim121@gmail.com
                    </footer>
                </div>
            </div>
        </>
    );
}
