import {
    Activity,
    BarChart3,
    Bell,
    BookOpen,
    CalendarCheck2,
    Code2,
    FileText,
    FolderKanban,
    FolderPlus,
    Handshake,
    KeyRound,
    Layers3,
    LayoutDashboard,
    Link2,
    MessageSquareQuote,
    Network,
    Package,
    PackagePlus,
    PieChart,
    PlusCircle,
    Ruler,
    ShieldPlus,
    ShoppingBag,
    SlidersHorizontal,
    Sparkles,
    Tags,
    UserPlus,
    Users,
    Wallet,
    type LucideIcon,
} from 'lucide-react';

/**
 * The admin's navigation, in one place: the sidebar, the top bar's page title
 * and the "which item is active" logic all read this.
 *
 * `match` lists route prefixes (Next's pathname, e.g. /bookings/details/[id])
 * that belong to the item, so a detail or edit page lights up the list it came
 * from. Without `match`, an item is active only on its own href.
 */
export type NavItem = {
    label: string;
    href: string;
    icon: LucideIcon;
    match?: string[];
};

export type NavGroup = {
    label: string;
    items: NavItem[];
    /** Collapsed unless one of its items is the current page. */
    collapsible?: boolean;
};

export const NAV: NavGroup[] = [
    {
        label: 'Overview',
        items: [
            { label: 'Dashboard', href: '/', icon: LayoutDashboard },
            { label: 'Investor report', href: '/reports/investors', icon: PieChart },
            { label: 'Operations report', href: '/reports', icon: BarChart3 },
        ],
    },
    {
        label: 'Bookings',
        items: [
            { label: 'All bookings', href: '/bookings/list', icon: CalendarCheck2, match: ['/bookings/list', '/bookings/details'] },
            { label: 'Active bookings', href: '/bookings/active-booking', icon: Activity },
            { label: 'New booking', href: '/bookings/create', icon: PlusCircle },
        ],
    },
    {
        label: 'People',
        items: [
            { label: 'Investors', href: '/users', icon: Users },
            { label: 'Partners', href: '/partners/list', icon: Handshake, match: ['/partners/list', '/partners/details', '/partners/edit'] },
            { label: 'Register partner', href: '/partners/registration', icon: UserPlus },
        ],
    },
    {
        label: 'Projects',
        items: [
            { label: 'All projects', href: '/projects/list', icon: FolderKanban, match: ['/projects/list', '/projects/details', '/projects/edit'] },
            { label: 'New project', href: '/projects/create', icon: FolderPlus },
            { label: 'Assign partners', href: '/projects/partner_assign', icon: Network },
            { label: 'Assign projects', href: '/projects/project_assign', icon: Link2 },
        ],
    },
    {
        label: 'Shathi Mart',
        items: [
            { label: 'Products', href: '/products/list', icon: Package, match: ['/products/list', '/products/details'] },
            { label: 'New product', href: '/products/create', icon: PackagePlus },
            { label: 'Categories', href: '/products/category', icon: Tags },
            { label: 'Orders', href: '/orders/list', icon: ShoppingBag, match: ['/orders/list', '/orders/details'] },
        ],
    },
    {
        label: 'Content',
        items: [
            { label: 'Blogs', href: '/blogs/list', icon: BookOpen, match: ['/blogs/list', '/blogs/edit'] },
            { label: 'New blog', href: '/blogs/create', icon: FileText },
            { label: 'Notifications', href: '/notification', icon: Bell, match: ['/notification'] },
        ],
    },
    {
        label: 'Settings',
        collapsible: true,
        items: [
            { label: 'Investment plans', href: '/setup/investment', icon: Wallet },
            { label: 'Stat panel', href: '/setup/stat_panel', icon: SlidersHorizontal },
            { label: 'Project categories', href: '/setup/project_category', icon: Layers3 },
            { label: 'Skills', href: '/setup/skill', icon: Sparkles },
            { label: 'Units', href: '/setup/unit', icon: Ruler },
            { label: 'Partnerships', href: '/setup/partnership', icon: Handshake },
            { label: 'Testimonials', href: '/setup/investor_testimonial', icon: MessageSquareQuote },
            { label: 'API map', href: '/api-viewer', icon: Code2 },
            { label: 'Add admin', href: '/admin/registration', icon: ShieldPlus },
            { label: 'Your account', href: '/account', icon: KeyRound },
        ],
    },
];

export function isActive(item: NavItem, pathname: string): boolean {
    if (!item.match) return pathname === item.href;
    return item.match.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** The nav item for the current page, if any (for the top bar's title). */
export function currentItem(pathname: string): { group: NavGroup; item: NavItem } | null {
    for (const group of NAV) {
        for (const item of group.items) {
            if (isActive(item, pathname)) return { group, item };
        }
    }
    return null;
}
