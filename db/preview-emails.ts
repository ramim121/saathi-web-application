/**
 * Renders every email to disk so they can be opened in a browser and looked at.
 *
 * Email templates are the one thing here that cannot be checked by running the
 * app: they are built server-side, handed to a third party, and rendered by a
 * client we do not control. Without this, "does it look right" means sending
 * yourself real mail and waiting.
 *
 *   TS_NODE_BASEURL=. npx ts-node -r tsconfig-paths/register \
 *     --compiler-options '{"module":"commonjs","target":"es2020","esModuleInterop":true}' \
 *     db/preview-emails.ts
 *
 * Writes to db/email-preview/, which is gitignored — build artefacts, not source.
 */
import fs from 'fs';
import path from 'path';
import { renderEmailVerificationCode } from '../src/notifications/renderEmailVerification';
import { renderTemplate, TEMPLATE_NAMES, type TemplateData, type TemplateName } from '../src/notifications/templates';

const outDir = path.join(__dirname, 'email-preview');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

/**
 * Realistic sample data per template.
 *
 * Deliberately not minimal: a template that only looks right with one short
 * project name and a round number is a template that will look wrong in
 * production. Long names, multiple rows and awkward amounts are the point.
 */
const SAMPLES: Record<TemplateName, TemplateData> = {
    signup_completion: {},
    email_verified_manual: {},
    phone_verified_manual: {},
    nid_verified: {},
    nid_verification_failed: {},
    booking_placed: {
        bookingId: '000131',
        totalAmount: 187500,
        projects: [
            { projectName: 'Mymensingh Cattle Rearing — Winter Cycle', unitPurchased: 3, duration: 6, tenure: 'months' },
            { projectName: 'Rangpur Potato', unitPurchased: 1, duration: 4, tenure: 'months' },
        ],
    },
    booking_active: { bookingId: '000131' },
    booking_cancelled: { bookingId: '000129' },
    project_maturity_2_weeks: { projectName: 'Mymensingh Cattle Rearing — Winter Cycle' },
    project_maturity_1_week: {
        projectName: 'Mymensingh Cattle Rearing — Winter Cycle',
        maturityDate: '28 August 2026',
        suggestedProjects: [
            { projectName: 'Jamalpur Goat Rearing', categoryName: 'Livestock', duration: 6, tenure: 'months', unitInvestmentValue: 25000 },
            { projectName: 'Tangail Handloom', categoryName: 'Artisanal', duration: 4, tenure: 'months', unitInvestmentValue: 15000 },
            { projectName: 'Bogura Vegetable', categoryName: 'Agriculture', duration: 3, tenure: 'months', unitInvestmentValue: 10000 },
        ],
    },
    account_delete_otp: { otp: '5182' },
};

type Sample = { name: string; group: string; locale: string; who: string; subject: string; html: string; text: string };
const rendered: Sample[] = [];

// The name is on every template's greeting, and 121 of 425 accounts have none —
// so the nameless case is not an edge case and gets rendered too.
const NAMES: Array<[string, string | null]> = [
    ['named', 'Ayesha Rahman'],
    ['noname', null],
];

for (const name of TEMPLATE_NAMES) {
    for (const locale of ['en', 'bn'] as const) {
        for (const [suffix, fullName] of NAMES) {
            // Only the nameless English variant of each is kept alongside the
            // named ones, to keep the sheet readable; the greeting is the only
            // difference and it is shared code.
            if (suffix === 'noname' && locale === 'bn') continue;

            const out = renderTemplate(name, { ...SAMPLES[name], fullName }, locale);
            rendered.push({
                name: `${name}.${locale}.${suffix}`,
                group: name,
                locale: locale === 'bn' ? 'বাংলা' : 'English',
                who: fullName ? 'Name on file' : 'No name — 121 accounts',
                ...out,
            });
        }
    }
}

for (const locale of ['en', 'bn'] as const) {
    const out = renderEmailVerificationCode({
        fullName: 'Ayesha Rahman',
        code: '407913',
        link: 'https://new.digigramventures.com/account/email/verify?token=preview',
        expiresInMinutes: 30,
        locale,
    });
    rendered.push({
        name: `email_verification_code.${locale}.named`,
        group: 'email_verification_code',
        locale: locale === 'bn' ? 'বাংলা' : 'English',
        who: 'Name on file',
        ...out,
    });
}

/* -------- checks that would otherwise only be caught by a human squinting -- */

const problems: string[] = [];
for (const s of rendered) {
    if (/undefined|\[object Object\]|NaN/.test(s.html)) problems.push(`${s.name}: unresolved value in HTML`);
    if (/undefined|\[object Object\]|NaN/.test(s.subject)) problems.push(`${s.name}: unresolved value in subject`);
    if (/\$\{|<%/.test(s.html)) problems.push(`${s.name}: an unrendered template placeholder survived`);
    if (!s.text.trim()) problems.push(`${s.name}: empty plain-text part`);
    if (/Dear\s*,|প্রিয়\s*,/.test(s.html)) problems.push(`${s.name}: greeting with an empty name`);
    if (/©\s*20(2[0-5])\b/.test(s.html)) problems.push(`${s.name}: hardcoded past year`);
    // Copy rules, not style: no promise of returns anywhere in outbound mail.
    if (/high return|guaranteed return|safe, high/i.test(s.html)) problems.push(`${s.name}: returns promise in copy`);
    for (const tag of ['</html>', '</body>', '</table>']) {
        if (!s.html.includes(tag)) problems.push(`${s.name}: missing ${tag}`);
    }
    const open = (s.html.match(/<table/g) ?? []).length;
    const close = (s.html.match(/<\/table>/g) ?? []).length;
    if (open !== close) problems.push(`${s.name}: ${open} <table> vs ${close} </table>`);
    const tdOpen = (s.html.match(/<td[\s>]/g) ?? []).length;
    const tdClose = (s.html.match(/<\/td>/g) ?? []).length;
    if (tdOpen !== tdClose) problems.push(`${s.name}: ${tdOpen} <td> vs ${tdClose} </td>`);
}

for (const s of rendered) {
    fs.writeFileSync(path.join(outDir, `${s.name}.html`), s.html, 'utf8');
    fs.writeFileSync(path.join(outDir, `${s.name}.txt`), s.text, 'utf8');
}

fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(rendered.map(({ html, text, ...rest }) => ({ ...rest, bytes: html.length, textBytes: text.length })), null, 2), 'utf8');

console.log(`${rendered.length} rendered\n`);
for (const s of rendered) {
    console.log(`  ${s.name.padEnd(46)} ${String(s.html.length).padStart(6)}b   ${s.subject}`);
}

if (problems.length) {
    console.log(`\n${problems.length} PROBLEM(S):`);
    for (const p of problems) console.log(`  ✗ ${p}`);
    process.exit(1);
}
console.log('\nAll structural and copy checks passed.');
