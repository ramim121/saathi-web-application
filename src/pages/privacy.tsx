import Head from 'next/head';
import React, { type ReactNode } from 'react';
import { inter } from '@/ui/font';
import { cx } from '@/ui/primitives';

/**
 * Public privacy policy (linked from the app stores and the app). The wording is
 * the policy itself — change it only deliberately, and update "Last updated".
 */

const EMAIL = 'support@digigramventures.com';
const PHONE = '+8801707247474';

const SECTIONS = [
    { id: 'information-we-collect', title: '1. Information We Collect' },
    { id: 'how-we-use-your-information', title: '2. How We Use Your Information' },
    { id: 'how-we-share-your-information', title: '3. How We Share Your Information' },
    { id: 'data-security', title: '4. Data Security' },
    { id: 'your-data-rights', title: '5. Your Data Rights' },
    { id: 'cookies', title: '6. Cookies and Tracking Technologies' },
    { id: 'third-party-links', title: '7. Third-party Links' },
    { id: 'changes', title: '8. Changes to This Privacy Policy' },
    { id: 'contact-us', title: '9. Contact Us' },
] as const;

type SectionId = (typeof SECTIONS)[number]['id'];

function Section({ id, children }: { id: SectionId; children: ReactNode }) {
    const title = SECTIONS.find((s) => s.id === id)?.title;
    return (
        <section id={id} className="tw-scroll-mt-6 tw-border-t tw-border-slate-100 tw-pt-8 first:tw-border-0 first:tw-pt-0">
            <h2 className="tw-text-lg tw-font-semibold tw-tracking-tight tw-text-slate-900">{title}</h2>
            <div className="tw-mt-3 tw-space-y-3">{children}</div>
        </section>
    );
}

function P({ children }: { children: ReactNode }) {
    return <p className="tw-text-[15px] tw-leading-7 tw-text-slate-600">{children}</p>;
}

function List({ children }: { children: ReactNode }) {
    return <ul className="tw-list-disc tw-space-y-2 tw-pl-5 tw-text-[15px] tw-leading-7 tw-text-slate-600 marker:tw-text-slate-300">{children}</ul>;
}

function Term({ children }: { children: ReactNode }) {
    return <strong className="tw-font-semibold tw-text-slate-900">{children}</strong>;
}

const link = 'tw-font-medium tw-text-brand-700 tw-underline tw-decoration-brand-700/30 tw-underline-offset-2 hover:tw-decoration-brand-700';

const PrivacyPolicy = () => {
    return (
        <>
            <Head>
                <title>Privacy Policy · Shathi App</title>
                <meta content="width=device-width, initial-scale=1" name="viewport" />
            </Head>
            <div className={cx(inter.variable, 'ui tw-min-h-screen tw-bg-slate-50')}>
                <header className="tw-bg-[#0b1238]">
                    <div className="tw-mx-auto tw-max-w-3xl tw-px-5 tw-py-5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/assets/images/logo-header.png" alt="Shathi" className="tw-h-8 tw-w-auto" />
                    </div>
                </header>

                <main className="tw-mx-auto tw-max-w-3xl tw-px-5 tw-py-10 sm:tw-py-14">
                    <h1 className="tw-text-3xl tw-font-semibold tw-tracking-tight tw-text-slate-900 sm:tw-text-4xl">Privacy Policy for Shathi App</h1>
                    <p className="tw-mt-3 tw-text-sm tw-text-slate-500">
                        <strong className="tw-font-semibold tw-text-slate-700">Last updated:</strong> November 17th, 2026
                    </p>

                    <p className="tw-mt-6 tw-text-base tw-leading-7 tw-text-slate-700">
                        At DigiGram Ventures, we are committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use the Shathi App, our investment and e-commerce platform designed to empower rural women farmers. Please read this policy carefully to understand our practices regarding your personal data and how we will treat it.
                    </p>

                    <nav aria-label="Contents" className="tw-mt-8 tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-5">
                        <p className="tw-text-xs tw-font-semibold tw-uppercase tw-tracking-wider tw-text-slate-500">Contents</p>
                        <ol className="tw-mt-3 tw-grid tw-gap-x-6 tw-gap-y-1.5 tw-text-sm sm:tw-grid-cols-2">
                            {SECTIONS.map((s) => (
                                <li key={s.id}>
                                    <a href={`#${s.id}`} className="tw-text-slate-700 hover:tw-text-brand-700 hover:tw-underline">
                                        {s.title}
                                    </a>
                                </li>
                            ))}
                        </ol>
                    </nav>

                    <article className="tw-mt-8 tw-space-y-8 tw-rounded-2xl tw-border tw-border-slate-200 tw-bg-white tw-p-6 tw-shadow-card sm:tw-p-10">
                        <Section id="information-we-collect">
                            <P>We may collect and process the following types of information:</P>
                            <List>
                                <li><Term>Personal Identification Information:</Term> When you register on our app, we collect details such as your name, email address, phone number, date of birth, and National ID (NID) card information (including front and back photos of the NID).</li>
                                <li><Term>Financial Information:</Term> Information related to your investments, payments, and transactions within the app, including bank account details, transaction amounts, and history.</li>
                                <li><Term>Profile Data:</Term> This includes your profile information such as your investment interests, your activity within the platform, and information about your projects and orders from Shathi Mart.</li>
                                <li><Term>Biometric Data:</Term> A facial photo may be required during registration to verify your identity, especially during the KYC (Know Your Customer) process.</li>
                                <li><Term>Device Information:</Term> We collect information about the device you use to access the app, such as device type, operating system, and IP address.</li>
                            </List>
                        </Section>

                        <Section id="how-we-use-your-information">
                            <P>We use the information we collect to:</P>
                            <List>
                                <li><Term>Provide and Improve Our Services:</Term> This includes enabling you to invest in projects, shop from Shathi Mart, and interact with other users on the platform.</li>
                                <li><Term>User Verification:</Term> To verify your identity using your NID and biometric data (such as a facial photo) during registration.</li>
                                <li><Term>Payment Processing:</Term> To facilitate transactions, including investments and purchases within the app.</li>
                                <li><Term>Marketing and Communications:</Term> With your consent, we may send you promotional offers, updates about new features, or marketing information related to your use of the app.</li>
                                <li><Term>Compliance with Laws:</Term> To ensure that we comply with applicable laws and regulations, especially those related to financial transactions and investments.</li>
                            </List>
                        </Section>

                        <Section id="how-we-share-your-information">
                            <P>We may share your personal information in the following cases:</P>
                            <List>
                                <li><Term>Third-party Service Providers:</Term> We may share your information with third parties that provide services such as payment processing, identity verification, and marketing on our behalf.</li>
                                <li><Term>Legal Requirements:</Term> We may disclose your information to comply with legal obligations or respond to lawful requests, such as a court order, government inquiry, or other legal process.</li>
                                <li><Term>Business Transfers:</Term> In the event of a merger, sale, or transfer of assets, your information may be transferred as part of the transaction.</li>
                            </List>
                        </Section>

                        <Section id="data-security">
                            <P>We implement appropriate technical and organizational measures to ensure the security of your personal data. These measures include data encryption, secure servers, and restricted access to sensitive information. However, please be aware that no system is completely secure, and we cannot guarantee the absolute security of your data.</P>
                        </Section>

                        <Section id="your-data-rights">
                            <P>You have the following rights regarding your personal data:</P>
                            <List>
                                <li><Term>Access:</Term> You can request a copy of the personal data we hold about you.</li>
                                <li><Term>Correction:</Term> You can request that we correct any inaccurate or incomplete information.</li>
                                <li><Term>Deletion:</Term> You can request that we delete your personal data, subject to certain legal obligations.</li>
                                <li><Term>Withdrawal of Consent:</Term> If we are processing your personal data based on your consent, you can withdraw that consent at any time.</li>
                            </List>
                            <P>
                                To exercise these rights, please contact us at <a href={`mailto:${EMAIL}`} className={link}>{EMAIL}</a>.
                            </P>
                        </Section>

                        <Section id="cookies">
                            <P>We may use cookies and similar tracking technologies to collect information about your interactions with the app. This helps us improve user experience and analyze trends.</P>
                        </Section>

                        <Section id="third-party-links">
                            <P>Our app may contain links to third-party websites or services. We are not responsible for the privacy practices or the content of these third-party sites. Please review the privacy policies of any external sites before providing them with your information.</P>
                        </Section>

                        <Section id="changes">
                            <P>We may update this Privacy Policy from time to time. Any changes will be posted on this page with an updated effective date. We encourage you to review this Privacy Policy periodically to stay informed about how we are protecting your information.</P>
                        </Section>

                        <Section id="contact-us">
                            <P>If you have any questions or concerns about this Privacy Policy, please contact us at:</P>
                            <address className="tw-rounded-xl tw-bg-slate-50 tw-p-4 tw-text-[15px] tw-not-italic tw-leading-7 tw-text-slate-600">
                                <strong className="tw-font-semibold tw-text-slate-900">DigiGram Ventures</strong>
                                <br />
                                Email: <a href={`mailto:${EMAIL}`} className={link}>{EMAIL}</a>
                                <br />
                                Phone: <a href={`tel:${PHONE}`} className={link}>{PHONE}</a>
                            </address>
                        </Section>
                    </article>

                    <p className="tw-mt-8 tw-text-xs tw-text-slate-400">Shathi · DigiGram Ventures</p>
                </main>
            </div>
        </>
    );
}

export default PrivacyPolicy;

PrivacyPolicy.getLayout = function PageLayout(page: any) {
    return (
        <div>
            {page}
        </div>
    )
}
