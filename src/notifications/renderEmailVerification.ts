import {
    renderShell,
    greeting,
    heading,
    paragraph,
    codeBlock,
    button,
    note,
    escapeHtml,
    type EmailLocale,
} from '@/notifications/shell';

/**
 * The "confirm your email address" message.
 *
 * BOTH A CODE AND A LINK, IN THAT ORDER
 * The code comes first because most of these are read on a phone, where the
 * mail app and the browser are separate apps and following a link loses the
 * session the person was half way through. The link is offered underneath for
 * anyone reading on a desktop.
 *
 * WHY THIS ONE IS TYPESCRIPT AND NOT AN .html FILE
 * The existing templates are read off disk and rendered by `eval()`-ing them as
 * a template literal. That is fine for copy an admin might edit, but this
 * message carries a live credential and is the one email that must not be
 * editable into something that leaks it. Building it in code also means the
 * code and the link cannot be accidentally dropped from the markup.
 */

export type EmailVerificationCopy = {
    fullName: string | null;
    code: string;
    link: string;
    expiresInMinutes: number;
    locale: EmailLocale;
};

export function renderEmailVerificationCode({
    fullName,
    code,
    link,
    expiresInMinutes,
    locale,
}: EmailVerificationCopy): { subject: string; html: string; text: string } {
    const bn = locale === 'bn';

    const subject = bn
        ? `আপনার সাথী যাচাই কোড ${code}`
        : `${code} is your Shathi verification code`;

    const preheader = bn
        ? `কোডটি ${expiresInMinutes} মিনিটের জন্য বৈধ।`
        : `This code is valid for ${expiresInMinutes} minutes.`;

    const body = [
        heading(bn ? 'আপনার ইমেইল ঠিকানা নিশ্চিত করুন' : 'Confirm your email address'),
        paragraph(greeting(fullName, locale)),
        paragraph(
            bn
                ? 'নিচের কোডটি সাথীতে দিন। এতে আপনার ইমেইল ঠিকানা যাচাই হবে, আর ফোন নম্বরের পাশাপাশি ইমেইল দিয়েও লগ ইন করতে পারবেন।'
                : 'Enter this code in Shathi to confirm your address. Once confirmed you can sign in with your email as well as your phone number.',
        ),
        codeBlock(code),
        paragraph(
            bn
                ? `কোডটি <strong>${expiresInMinutes} মিনিট</strong> পর মেয়াদোত্তীর্ণ হবে।`
                : `The code expires in <strong>${expiresInMinutes} minutes</strong>.`,
        ),
        paragraph(
            bn
                ? 'কম্পিউটার থেকে পড়ছেন? কোড না লিখে সরাসরি নিশ্চিত করতে পারেন:'
                : 'Reading this on a computer? You can confirm directly instead of typing the code:',
        ),
        button(bn ? 'ইমেইল নিশ্চিত করুন' : 'Confirm my email', link),
        note(
            bn
                ? 'আপনি যদি এটি না চেয়ে থাকেন, কিছুই করার নেই — এই কোড ছাড়া আপনার অ্যাকাউন্টে কোনো পরিবর্তন হবে না। সাথী কখনো আপনার কোড জানতে চাইবে না; কেউ চাইলে দেবেন না।'
                : 'If you did not ask for this, nothing needs doing — no change is made to your account without this code. Shathi will never ask you for it. If someone does, do not share it.',
        ),
    ].join('\n');

    /*
     * A real plain-text alternative, not a stripped copy of the HTML.
     *
     * Some clients show text/plain by preference, and spam filters score a
     * message with an empty text part badly — the existing templates send none
     * at all.
     */
    const text = bn
        ? [
              greetingText(fullName, locale),
              '',
              'নিচের কোডটি সাথীতে দিন:',
              '',
              `    ${code}`,
              '',
              `কোডটি ${expiresInMinutes} মিনিট পর মেয়াদোত্তীর্ণ হবে।`,
              '',
              'অথবা এই লিংকে যান:',
              link,
              '',
              'আপনি এটি না চেয়ে থাকলে কিছুই করার নেই। সাথী কখনো আপনার কোড জানতে চাইবে না।',
              '',
              '— সাথী টিম',
          ].join('\n')
        : [
              greetingText(fullName, locale),
              '',
              'Enter this code in Shathi to confirm your email address:',
              '',
              `    ${code}`,
              '',
              `The code expires in ${expiresInMinutes} minutes.`,
              '',
              'Or open this link:',
              link,
              '',
              'If you did not ask for this, nothing needs doing. Shathi will never ask you for this code.',
              '',
              '— The Shathi Team',
          ].join('\n');

    return { subject, html: renderShell({ locale, preheader, body }), text };
}

/** The greeting again, without the HTML escaping, for the text part. */
function greetingText(fullName: string | null, locale: EmailLocale): string {
    const name = (fullName ?? '').trim();
    if (locale === 'bn') return name ? `প্রিয় ${name},` : 'প্রিয় গ্রাহক,';
    return name ? `Dear ${name},` : 'Hello,';
}

/** Re-exported so callers do not need to import the shell for one helper. */
export { escapeHtml };
