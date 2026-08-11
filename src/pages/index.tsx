import React from 'react';
import Link from 'next/link';
import { Container, Row, Col, Card } from 'react-bootstrap';
import { GetServerSidePropsContext } from 'next';
import MainLayout from '@/layouts/MainLayout';
import notification from '@/notifications';
import { requireAdminPage, redirectToLogin } from '@/utils/pageAuth';

/**
 * Admin landing page.
 *
 * It used to render the literal text "WELCOME HOME" for anyone who reached it,
 * signed in or not, and it imported `next/font/google` without using the result.
 *
 * Now it is gated: an unauthenticated visitor is redirected to the login page,
 * and an admin gets a way into the sections they actually use. There are
 * deliberately **no counts or figures here** — every number on an admin screen
 * should come from the same query the section itself runs, and a dashboard
 * statistic that disagrees with the list it links to is worse than no statistic.
 */

type Shortcut = {
    href: string;
    title: string;
    body: string;
};

const SHORTCUTS: Shortcut[] = [
    {
        href: '/bookings/list',
        title: 'Bookings',
        body: 'Confirm payments, review proof of payment, cancel or deny a booking.',
    },
    {
        href: '/projects/list',
        title: 'Projects',
        body: 'Create and edit projects, assign Shathi partners, change project status.',
    },
    {
        href: '/users',
        title: 'Users',
        body: 'Verify NID, email and phone. View linked bank accounts.',
    },
    {
        href: '/partners/list',
        title: 'Partners',
        body: 'Register Shathi partners and maintain their profiles.',
    },
    {
        href: '/orders/list',
        title: 'Orders',
        body: 'Shathi Sheba product orders and their delivery status.',
    },
    {
        href: '/blogs/list',
        title: 'Content',
        body: 'Blog posts, partnerships, testimonials and app stat panels.',
    },
    {
        href: '/notification',
        title: 'Notifications',
        body: 'Send a manual notification to app users.',
    },
    {
        href: '/api-viewer',
        title: 'API map',
        body: 'Every backend route, who calls it, and how web and app differ.',
    },
];

export default function Home({ name }: { name: string }) {
    return (
        <Container className="py-4">
            <h4 className="mb-1">Welcome{name ? `, ${name}` : ''}</h4>
            <p className="text-muted">Choose a section to work in.</p>

            <Row className="g-3 mt-1">
                {SHORTCUTS.map((item) => (
                    <Col key={item.href} md={6} lg={3}>
                        <Card className="h-100">
                            <Card.Body>
                                <Card.Title as="h6" className="mb-2">
                                    <Link href={item.href} className="stretched-link text-decoration-none">
                                        {item.title}
                                    </Link>
                                </Card.Title>
                                <Card.Text className="text-muted small mb-0">{item.body}</Card.Text>
                            </Card.Body>
                        </Card>
                    </Col>
                ))}
            </Row>
        </Container>
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

    return { props: { name: '' } };
}

Home.getLayout = function getLayout(page: React.ReactNode) {
    return <MainLayout>{page}</MainLayout>;
};
