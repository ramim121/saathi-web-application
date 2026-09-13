import {
    renderShell, greeting, heading, paragraph, button, note, detailRows, spacer, escapeHtml,
    type EmailLocale,
} from '@/notifications/shell';
import { WEB_BASE_URL } from '@/config/constants';

/**
 * Every transactional email, in English and Bangla.
 *
 * WHY THESE MOVED OUT OF .html FILES
 * The old templates were read off disk and rendered by `eval()`-ing the file as
 * a JavaScript template literal. That has three problems this replaces:
 *
 *   1. no escaping — a name containing `<` broke the layout, and the rendering
 *      mechanism is `eval`, which is not somewhere to be relaxed about input;
 *   2. no type safety — a template referencing `data.bookingId` when the caller
 *      passes `booking_id` renders the literal text `undefined` into an email
 *      that has already been sent;
 *   3. one language only.
 *
 * WHAT DECIDES THE LANGUAGE
 * `users.preferred_language` (migration 011). NULL means never asked, and is
 * treated as English — which is what all 425 existing accounts have been
 * receiving, so nobody's mail silently changes language.
 *
 * COPY RULES THAT ARE NOT STYLE CHOICES
 *   * No promise of returns, guaranteed or implied. The old
 *     `signup_completion.html` told every new user Shathi offers "safe, high
 *     return projects"; that is a returns promise in a live outbound email and
 *     it is gone.
 *   * Nothing asserts a reason we do not know. The old booking-cancelled SMS
 *     told everyone their booking was cancelled "due to failure to submit proof
 *     of payment", including people who cancelled it themselves.
 */

export type TemplateName =
    | 'signup_completion'
    | 'email_verified_manual'
    | 'phone_verified_manual'
    | 'nid_verified'
    | 'nid_verification_failed'
    | 'booking_placed'
    | 'booking_active'
    | 'booking_cancelled'
    | 'project_maturity_2_weeks'
    | 'project_maturity_1_week'
    | 'account_delete_otp';

export type TemplateData = {
    fullName?: string | null;
    otp?: string;
    bookingId?: string;
    totalAmount?: number | string;
    projects?: Array<{
        projectName?: string;
        unitPurchased?: number | string;
        duration?: number | string;
        tenure?: string;
    }>;
    projectName?: string;
    maturityDate?: string;
    suggestedProjects?: Array<{
        projectName?: string;
        categoryName?: string;
        duration?: number | string;
        tenure?: string;
        unitInvestmentValue?: number | string;
        returnRangeMin?: number | string;
        returnRangeMax?: number | string;
    }>;
};

export type Rendered = { subject: string; html: string; text: string };

const url = (path: string) => `${WEB_BASE_URL}${path}`;

/** Bangla digits, for amounts and counts inside Bangla copy. */
function bnDigits(value: string | number): string {
    return String(value).replace(/[0-9]/g, (d) => '০১২৩৪৫৬৭৮৯'[Number(d)]);
}

function money(amount: number | string | undefined, locale: EmailLocale): string {
    const n = Number(amount ?? 0);
    const formatted = n.toLocaleString('en-US');
    return locale === 'bn' ? `৳ ${bnDigits(formatted)}` : `BDT ${formatted}`;
}

function num(value: number | string | undefined, locale: EmailLocale): string {
    return locale === 'bn' ? bnDigits(value ?? 0) : String(value ?? 0);
}

/** Greeting without HTML escaping, for the plain-text part. */
function greetingText(fullName: string | null | undefined, locale: EmailLocale): string {
    const name = (fullName ?? '').trim();
    if (locale === 'bn') return name ? `প্রিয় ${name},` : 'প্রিয় গ্রাহক,';
    return name ? `Dear ${name},` : 'Hello,';
}

function signOff(locale: EmailLocale): string {
    return locale === 'bn' ? '\n\n— সাথী টিম' : '\n\n— The Shathi Team';
}

function build(
    locale: EmailLocale,
    subject: string,
    preheader: string,
    rows: string[],
    textLines: string[],
): Rendered {
    return {
        subject,
        html: renderShell({ locale, preheader, body: rows.join('\n') }),
        text: textLines.join('\n') + signOff(locale),
    };
}

/* ------------------------------------------------------------- renderers -- */

const RENDERERS: Record<TemplateName, (d: TemplateData, l: EmailLocale) => Rendered> = {
    /* ---------------------------------------------------------------------- */
    signup_completion(d, l) {
        const bn = l === 'bn';
        return build(
            l,
            bn ? 'সাথীতে স্বাগতম' : 'Welcome to Shathi',
            bn ? 'আপনার অ্যাকাউন্ট তৈরি হয়েছে।' : 'Your account is ready.',
            [
                heading(bn ? 'সাথীতে স্বাগতম' : 'Welcome to Shathi'),
                paragraph(greeting(d.fullName, l)),
                paragraph(
                    bn
                        ? 'আপনার অ্যাকাউন্ট তৈরি হয়েছে। সাথীর মাধ্যমে আপনি বাংলাদেশের কৃষি, প্রাণিসম্পদ ও কুটিরশিল্পের প্রকল্পে অংশ নিতে পারেন — যেখানে প্রতিটি প্রকল্পের পেছনে থাকেন একজন প্রকৃত সাথী।'
                        : 'Your account is ready. Shathi lets you take part in agriculture, livestock and artisanal projects across Bangladesh — each one run by a real partner on the ground.',
                ),
                /*
                 * The old template said "safe, high return projects" here. Both
                 * halves of that were a problem: it promised returns, and it
                 * called them safe. Replaced with what is actually true — you
                 * can see the project and the partner before committing.
                 */
                paragraph(
                    bn
                        ? 'বিনিয়োগের আগে প্রতিটি প্রকল্পের মেয়াদ, একক মূল্য এবং কোন সাথী প্রকল্পটি পরিচালনা করছেন তা দেখে নিতে পারবেন।'
                        : 'Before committing to anything you can see each project\'s term, its unit value, and which partner is running it.',
                ),
                button(bn ? 'প্রকল্পগুলো দেখুন' : 'Browse projects', url('/projects')),
                note(
                    bn
                        ? 'বুকিং করার আগে আপনার এনআইডি যাচাই করা প্রয়োজন। এটি একবারই করতে হয়, আর এটিই নিশ্চিত করে যে আপনার অর্থ সঠিক ব্যক্তির কাছে ফেরত যাবে।'
                        : 'Before you can book, your NID has to be verified. It is a one-time step, and it is what makes sure a payout reaches the right person.',
                ),
            ],
            [
                greetingText(d.fullName, l),
                '',
                bn
                    ? 'আপনার সাথী অ্যাকাউন্ট তৈরি হয়েছে।'
                    : 'Your Shathi account is ready.',
                '',
                bn ? 'প্রকল্প দেখুন: ' : 'Browse projects: ',
                url('/projects'),
                '',
                bn
                    ? 'বুকিং করার আগে এনআইডি যাচাই করতে হবে — একবারই।'
                    : 'Before you can book, your NID has to be verified — a one-time step.',
            ],
        );
    },

    /* ---------------------------------------------------------------------- */
    email_verified_manual(d, l) {
        const bn = l === 'bn';
        return build(
            l,
            bn ? 'আপনার ইমেইল যাচাই হয়েছে' : 'Your email address is verified',
            bn ? 'এখন ইমেইল দিয়েও লগ ইন করতে পারবেন।' : 'You can now sign in with your email too.',
            [
                heading(bn ? 'ইমেইল যাচাই হয়েছে' : 'Email address verified'),
                paragraph(greeting(d.fullName, l)),
                paragraph(
                    bn
                        ? 'আপনার ইমেইল ঠিকানা যাচাই হয়ে গেছে। এখন ফোন নম্বরের পাশাপাশি ইমেইল দিয়েও একই অ্যাকাউন্টে লগ ইন করতে পারবেন।'
                        : 'Your email address has been verified. You can now sign in to the same account with either your email or your phone number.',
                ),
                button(bn ? 'আমার অ্যাকাউন্ট' : 'Go to my account', url('/account')),
            ],
            [
                greetingText(d.fullName, l),
                '',
                bn
                    ? 'আপনার ইমেইল ঠিকানা যাচাই হয়েছে। এখন ইমেইল বা ফোন — যেকোনোটি দিয়ে লগ ইন করতে পারবেন।'
                    : 'Your email address has been verified. You can now sign in with either your email or your phone number.',
                '',
                url('/account'),
            ],
        );
    },

    /* ---------------------------------------------------------------------- */
    phone_verified_manual(d, l) {
        const bn = l === 'bn';
        return build(
            l,
            bn ? 'আপনার ফোন নম্বর যাচাই হয়েছে' : 'Your phone number is verified',
            bn ? 'এখন ফোন নম্বর দিয়েও লগ ইন করতে পারবেন।' : 'You can now sign in with your number too.',
            [
                heading(bn ? 'ফোন নম্বর যাচাই হয়েছে' : 'Phone number verified'),
                paragraph(greeting(d.fullName, l)),
                paragraph(
                    bn
                        ? 'আপনার ফোন নম্বর যাচাই হয়ে গেছে। এসএমএসে পাঠানো কোড দিয়ে যেকোনো সময় লগ ইন করতে পারবেন — পাসওয়ার্ড মনে রাখার দরকার নেই।'
                        : 'Your phone number has been verified. You can sign in any time with a code sent by SMS — there is no password to remember.',
                ),
                button(bn ? 'আমার অ্যাকাউন্ট' : 'Go to my account', url('/account')),
            ],
            [
                greetingText(d.fullName, l),
                '',
                bn
                    ? 'আপনার ফোন নম্বর যাচাই হয়েছে। এসএমএস কোড দিয়ে লগ ইন করতে পারবেন।'
                    : 'Your phone number has been verified. You can sign in with a code sent by SMS.',
                '',
                url('/account'),
            ],
        );
    },

    /* ---------------------------------------------------------------------- */
    nid_verified(d, l) {
        const bn = l === 'bn';
        return build(
            l,
            bn ? 'আপনার এনআইডি যাচাই সম্পন্ন' : 'Your NID is verified',
            bn ? 'এখন আপনি বুকিং করতে পারবেন।' : 'You can now place a booking.',
            [
                heading(bn ? 'এনআইডি যাচাই সম্পন্ন' : 'NID verified'),
                paragraph(greeting(d.fullName, l)),
                paragraph(
                    bn
                        ? 'আপনার জাতীয় পরিচয়পত্র যাচাই হয়ে গেছে। এখন আপনি প্রকল্পে বুকিং দিতে পারবেন — এই ধাপটি আর কখনো করতে হবে না।'
                        : 'Your national ID has been verified. You can now place bookings on projects, and you will never need to do this step again.',
                ),
                button(bn ? 'প্রকল্পগুলো দেখুন' : 'Browse projects', url('/projects')),
                note(
                    bn
                        ? 'পরিশোধের অর্থ সঠিক অ্যাকাউন্টে যাওয়ার জন্য আপনার ব্যাংক তথ্য হালনাগাদ আছে কি না দেখে নিন।'
                        : 'Worth checking your bank details are up to date, so a payout goes to the right account.',
                ),
            ],
            [
                greetingText(d.fullName, l),
                '',
                bn
                    ? 'আপনার এনআইডি যাচাই সম্পন্ন হয়েছে। এখন বুকিং করতে পারবেন।'
                    : 'Your NID has been verified. You can now place bookings.',
                '',
                url('/projects'),
            ],
        );
    },

    /* ---------------------------------------------------------------------- */
    nid_verification_failed(d, l) {
        const bn = l === 'bn';
        return build(
            l,
            bn ? 'আপনার এনআইডি আবার জমা দিতে হবে' : 'Your NID needs to be submitted again',
            bn ? 'ছবিটি পড়া যায়নি।' : 'We could not read the images.',
            [
                heading(bn ? 'এনআইডি আবার জমা দিন' : 'Please submit your NID again'),
                paragraph(greeting(d.fullName, l)),
                /*
                 * Says what to do, and does not imply wrongdoing. A failed NID
                 * check is almost always a blurry photo, not a fake document,
                 * and the old copy read like an accusation.
                 */
                paragraph(
                    bn
                        ? 'আপনার জমা দেওয়া এনআইডির ছবি আমরা যাচাই করতে পারিনি — সাধারণত ছবি ঝাপসা হলে, আলো কম থাকলে বা কার্ডের কোনো অংশ ছবির বাইরে থাকলে এমন হয়।'
                        : 'We were not able to verify the NID images you submitted. This is usually a blurred photo, low light, or part of the card falling outside the frame.',
                ),
                paragraph(
                    bn
                        ? 'অ্যাপে গিয়ে দুই পাশের ছবি আবার তুলুন — ভালো আলোয়, পুরো কার্ডটি ফ্রেমের ভেতরে রেখে।'
                        : 'Open the app and photograph both sides again, in good light, with the whole card inside the frame.',
                ),
                button(bn ? 'আবার চেষ্টা করুন' : 'Try again', url('/account')),
                note(
                    bn
                        ? 'বুকিং করার আগে এনআইডি যাচাই আবশ্যক। কিছু আটকে গেলে info@digigramventures.com ঠিকানায় লিখুন।'
                        : 'NID verification is required before a booking can be placed. If something is stuck, write to info@digigramventures.com.',
                ),
            ],
            [
                greetingText(d.fullName, l),
                '',
                bn
                    ? 'আপনার এনআইডির ছবি যাচাই করা যায়নি — সাধারণত ছবি ঝাপসা বা অসম্পূর্ণ হলে এমন হয়। অ্যাপে গিয়ে দুই পাশের ছবি আবার তুলুন।'
                    : 'We could not verify your NID images — usually a blurred or partial photo. Please photograph both sides again in the app.',
            ],
        );
    },

    /* ---------------------------------------------------------------------- */
    booking_placed(d, l) {
        const bn = l === 'bn';
        const ref = d.bookingId ?? '';
        const projects = d.projects ?? [];

        const lines = projects.map((p) => {
            const term = [p.duration, p.tenure].filter(Boolean).join(' ');
            const units = bn
                ? `${bnDigits(p.unitPurchased ?? 0)} একক`
                : `${p.unitPurchased ?? 0} unit${Number(p.unitPurchased ?? 0) === 1 ? '' : 's'}`;
            return [String(p.projectName ?? ''), term ? `${units} · ${term}` : units] as [string, string];
        });

        return build(
            l,
            bn ? `বুকিং ${ref} নিশ্চিত হয়েছে` : `Booking ${ref} confirmed`,
            bn ? '৩ দিনের মধ্যে পরিশোধের প্রমাণ জমা দিন।' : 'Submit your proof of payment within 3 days.',
            [
                heading(bn ? 'আপনার বুকিং জমা হয়েছে' : 'Your booking is placed'),
                paragraph(greeting(d.fullName, l)),
                paragraph(
                    bn
                        ? `বুকিং <strong>${escapeHtml(ref)}</strong> গ্রহণ করা হয়েছে।`
                        : `Booking <strong>${escapeHtml(ref)}</strong> has been received.`,
                ),
                detailRows([
                    ...lines,
                    [bn ? 'মোট' : 'Total', money(d.totalAmount, l)],
                ]),
                paragraph(
                    bn
                        ? 'এখন নির্দেশনা অনুযায়ী পরিশোধ সম্পন্ন করে <strong>৩ দিনের মধ্যে</strong> রসিদ জমা দিন। অ্যাপ বা ওয়েবসাইটে "আমার বিনিয়োগ" অংশে অপশনটি পাবেন।'
                        : 'Complete the payment as instructed, then submit the receipt <strong>within 3 days</strong>. The option is under "My investments" in the app or on the website.',
                ),
                button(bn ? 'রসিদ জমা দিন' : 'Submit proof of payment', url('/account')),
                note(
                    bn
                        ? 'নির্ধারিত সময়ে রসিদ জমা না পড়লে বুকিংটি বাতিল হয়ে যাবে এবং এককগুলো আবার উন্মুক্ত হবে।'
                        : 'If no receipt arrives in that time the booking is cancelled and the units are released again.',
                ),
            ],
            [
                greetingText(d.fullName, l),
                '',
                bn ? `বুকিং ${ref} গ্রহণ করা হয়েছে।` : `Booking ${ref} has been received.`,
                '',
                ...lines.map(([a, b]) => `  ${a} — ${b}`),
                `  ${bn ? 'মোট' : 'Total'}: ${money(d.totalAmount, l)}`,
                '',
                bn
                    ? 'পরিশোধ সম্পন্ন করে ৩ দিনের মধ্যে রসিদ জমা দিন, নইলে বুকিং বাতিল হবে।'
                    : 'Complete the payment and submit the receipt within 3 days, or the booking is cancelled.',
                '',
                url('/account'),
            ],
        );
    },

    /* ---------------------------------------------------------------------- */
    booking_active(d, l) {
        const bn = l === 'bn';
        const ref = d.bookingId ?? '';
        return build(
            l,
            bn ? `বুকিং ${ref} এখন সক্রিয়` : `Booking ${ref} is now active`,
            bn ? 'আপনার পরিশোধ নিশ্চিত হয়েছে।' : 'Your payment has been confirmed.',
            [
                heading(bn ? 'আপনার বুকিং সক্রিয়' : 'Your booking is active'),
                paragraph(greeting(d.fullName, l)),
                paragraph(
                    bn
                        ? `আপনার পরিশোধ পাওয়া গেছে এবং বুকিং <strong>${escapeHtml(ref)}</strong> এখন সক্রিয়। প্রকল্পটির অগ্রগতি "আমার বিনিয়োগ" অংশে দেখতে পারবেন।`
                        : `Your payment has been received and booking <strong>${escapeHtml(ref)}</strong> is now active. You can follow the project under "My investments".`,
                ),
                button(bn ? 'আমার বিনিয়োগ' : 'My investments', url('/account')),
            ],
            [
                greetingText(d.fullName, l),
                '',
                bn
                    ? `পরিশোধ পাওয়া গেছে। বুকিং ${ref} এখন সক্রিয়।`
                    : `Payment received. Booking ${ref} is now active.`,
                '',
                url('/account'),
            ],
        );
    },

    /* ---------------------------------------------------------------------- */
    booking_cancelled(d, l) {
        const bn = l === 'bn';
        const ref = d.bookingId ?? '';
        return build(
            l,
            bn ? `বুকিং ${ref} বাতিল হয়েছে` : `Booking ${ref} has been cancelled`,
            bn ? 'এককগুলো আবার উন্মুক্ত করা হয়েছে।' : 'The units have been released.',
            [
                heading(bn ? 'বুকিং বাতিল হয়েছে' : 'Booking cancelled'),
                paragraph(greeting(d.fullName, l)),
                /*
                 * States the outcome, not a reason.
                 *
                 * The old copy asserted the booking was cancelled "due to
                 * failure to submit proof of payment in due time" — but this
                 * notification also fires when the investor cancels it
                 * themselves, and telling somebody they missed a deadline they
                 * did not miss is worse than saying less.
                 */
                paragraph(
                    bn
                        ? `বুকিং <strong>${escapeHtml(ref)}</strong> বাতিল করা হয়েছে এবং এককগুলো আবার উন্মুক্ত করা হয়েছে। এর জন্য আপনার কোনো অর্থ কাটা হয়নি।`
                        : `Booking <strong>${escapeHtml(ref)}</strong> has been cancelled and its units released. Nothing has been charged to you for it.`,
                ),
                paragraph(
                    bn
                        ? 'এটি আশা করেননি? তাহলে আমাদের জানান — আমরা দেখে নেব কী হয়েছে।'
                        : 'If you were not expecting this, tell us and we will look into what happened.',
                ),
                button(bn ? 'প্রকল্পগুলো দেখুন' : 'Browse projects', url('/projects')),
                note(
                    bn
                        ? 'প্রশ্ন থাকলে লিখুন info@digigramventures.com — বুকিং নম্বরটি উল্লেখ করবেন।'
                        : 'Questions? Write to info@digigramventures.com and quote the booking reference.',
                ),
            ],
            [
                greetingText(d.fullName, l),
                '',
                bn
                    ? `বুকিং ${ref} বাতিল করা হয়েছে এবং এককগুলো আবার উন্মুক্ত হয়েছে। কোনো অর্থ কাটা হয়নি।`
                    : `Booking ${ref} has been cancelled and its units released. Nothing has been charged.`,
                '',
                bn ? 'এটি আশা করেননি? লিখুন info@digigramventures.com' : 'Not expecting this? Write to info@digigramventures.com',
            ],
        );
    },

    /* ---------------------------------------------------------------------- */
    project_maturity_2_weeks(d, l) {
        const bn = l === 'bn';
        const name = d.projectName ?? '';
        return build(
            l,
            bn ? `${name} দুই সপ্তাহের মধ্যে মেয়াদপূর্ণ হচ্ছে` : `${name} matures in two weeks`,
            bn ? 'ব্যাংক তথ্য হালনাগাদ আছে কি না দেখে নিন।' : 'Check your bank details are up to date.',
            [
                heading(bn ? 'দুই সপ্তাহ বাকি' : 'Two weeks to go'),
                paragraph(greeting(d.fullName, l)),
                paragraph(
                    bn
                        ? `আপনার প্রকল্প <strong>${escapeHtml(name)}</strong> প্রায় মেয়াদপূর্ণ হতে চলেছে।`
                        : `Your project <strong>${escapeHtml(name)}</strong> is approaching maturity.`,
                ),
                paragraph(
                    bn
                        ? 'এখনই একটি কাজ করার আছে: আপনার ব্যাংক তথ্য ঠিক আছে কি না দেখে নিন। পরিশোধ ওই অ্যাকাউন্টেই যাবে, আর ভুল তথ্য থাকলে দেরি হয়।'
                        : 'One thing worth doing now: check your bank details are correct. That is the account a payout goes to, and wrong details are what cause delays.',
                ),
                button(bn ? 'ব্যাংক তথ্য দেখুন' : 'Check my bank details', url('/account')),
            ],
            [
                greetingText(d.fullName, l),
                '',
                bn
                    ? `${name} প্রায় মেয়াদপূর্ণ। আপনার ব্যাংক তথ্য ঠিক আছে কি না দেখে নিন — পরিশোধ ওই অ্যাকাউন্টেই যাবে।`
                    : `${name} is approaching maturity. Check your bank details are correct — that is where a payout goes.`,
                '',
                url('/account'),
            ],
        );
    },

    /* ---------------------------------------------------------------------- */
    project_maturity_1_week(d, l) {
        const bn = l === 'bn';
        const name = d.projectName ?? '';
        const when = d.maturityDate ?? '';
        const suggestions = (d.suggestedProjects ?? []).slice(0, 3);

        const rows = suggestions.map((p) => {
            const term = [p.duration, p.tenure].filter(Boolean).join(' ');
            const bits = [p.categoryName, term].filter(Boolean).join(' · ');
            return [
                String(p.projectName ?? ''),
                bits
                    ? `${bits} · ${money(p.unitInvestmentValue, l)}`
                    : money(p.unitInvestmentValue, l),
            ] as [string, string];
        });

        return build(
            l,
            bn ? `${name} ${when} তারিখে মেয়াদপূর্ণ হচ্ছে` : `${name} matures on ${when}`,
            bn ? 'এরপর কী করবেন ঠিক করুন।' : 'Decide what happens next.',
            [
                heading(bn ? 'এক সপ্তাহ বাকি' : 'One week to go'),
                paragraph(greeting(d.fullName, l)),
                paragraph(
                    bn
                        ? `আপনার প্রকল্প <strong>${escapeHtml(name)}</strong> <strong>${escapeHtml(when)}</strong> তারিখে মেয়াদপূর্ণ হবে।`
                        : `Your project <strong>${escapeHtml(name)}</strong> matures on <strong>${escapeHtml(when)}</strong>.`,
                ),
                paragraph(
                    bn
                        ? 'মেয়াদ শেষে আপনি অর্থ তুলে নিতে পারেন, অথবা নতুন কোনো প্রকল্পে আবার বিনিয়োগ করতে পারেন। সিদ্ধান্ত আপনার।'
                        : 'When it matures you can withdraw, or put it into another project. Either is fine — it is your call.',
                ),
                ...(rows.length
                    ? [
                          spacer(4),
                          paragraph(
                              bn
                                  ? '<strong>এখন উন্মুক্ত আছে</strong>'
                                  : '<strong>Open right now</strong>',
                          ),
                          detailRows(rows),
                      ]
                    : []),
                button(bn ? 'প্রকল্পগুলো দেখুন' : 'Browse projects', url('/projects')),
                note(
                    bn
                        ? 'কিছু না করলে মেয়াদ শেষে আপনার নিবন্ধিত ব্যাংক অ্যাকাউন্টেই অর্থ পাঠানো হবে।'
                        : 'If you do nothing, the payout goes to your registered bank account at maturity.',
                ),
            ],
            [
                greetingText(d.fullName, l),
                '',
                bn
                    ? `${name} ${when} তারিখে মেয়াদপূর্ণ হবে। আপনি অর্থ তুলে নিতে পারেন, অথবা নতুন প্রকল্পে বিনিয়োগ করতে পারেন।`
                    : `${name} matures on ${when}. You can withdraw, or reinvest in another project.`,
                ...(rows.length
                    ? ['', bn ? 'এখন উন্মুক্ত:' : 'Open right now:', ...rows.map(([a, b]) => `  ${a} — ${b}`)]
                    : []),
                '',
                url('/projects'),
            ],
        );
    },

    /* ---------------------------------------------------------------------- */
    account_delete_otp(d, l) {
        const bn = l === 'bn';
        const otp = d.otp ?? '';
        return build(
            l,
            bn ? `অ্যাকাউন্ট মুছে ফেলার কোড ${otp}` : `${otp} is your account deletion code`,
            bn ? 'আপনি না চাইলে এই কোড ব্যবহার করবেন না।' : 'Do not use this code unless you meant to.',
            [
                heading(bn ? 'অ্যাকাউন্ট মুছে ফেলার অনুরোধ' : 'Account deletion requested'),
                paragraph(greeting(d.fullName, l)),
                paragraph(
                    bn
                        ? 'আপনার সাথী অ্যাকাউন্ট মুছে ফেলার অনুরোধ এসেছে। নিশ্চিত করতে নিচের কোডটি দিন।'
                        : 'Somebody asked to delete your Shathi account. To confirm, enter this code.',
                ),
                // The code is rendered by the shell's codeBlock via detailRows'
                // sibling helper in the verification email; here the emphasis
                // belongs on the warning, so the code is stated plainly.
                detailRows([[bn ? 'কোড' : 'Code', otp]]),
                note(
                    bn
                        ? '<strong>এটি আপনি না চেয়ে থাকলে কোডটি ব্যবহার করবেন না এবং আমাদের জানান।</strong> কোড ছাড়া কোনো অ্যাকাউন্ট মোছা হবে না। মুছে ফেলা হলে আপনার বুকিং ও বিনিয়োগের তথ্য আর দেখা যাবে না।'
                        : '<strong>If you did not ask for this, do not use the code and tell us.</strong> No account is deleted without it. Once deleted, your bookings and investment history are no longer visible to you.',
                ),
            ],
            [
                greetingText(d.fullName, l),
                '',
                bn
                    ? `অ্যাকাউন্ট মুছে ফেলার কোড: ${otp}`
                    : `Your account deletion code: ${otp}`,
                '',
                bn
                    ? 'আপনি এটি না চেয়ে থাকলে কোডটি ব্যবহার করবেন না এবং আমাদের জানান। কোড ছাড়া কোনো অ্যাকাউন্ট মোছা হয় না।'
                    : 'If you did not ask for this, do not use the code and tell us. No account is deleted without it.',
            ],
        );
    },
};

export const TEMPLATE_NAMES = Object.keys(RENDERERS) as TemplateName[];

export function hasTemplate(name: string): name is TemplateName {
    return name in RENDERERS;
}

/**
 * Renders one notification.
 *
 * `locale` comes from `users.preferred_language`; NULL is treated as English,
 * which is what every existing account has always received.
 */
export function renderTemplate(
    name: TemplateName,
    data: TemplateData,
    locale: EmailLocale = 'en',
): Rendered {
    return RENDERERS[name](data, locale);
}
