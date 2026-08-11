/**
 * The shell every DigiGram email is built in.
 *
 * WHY A FUNCTION AND NOT ELEVEN COPIES OF THE SAME <table>
 * The existing templates each carry their own copy of the header, footer and
 * colours. They have already drifted — the brand is spelled both "Shathi" and
 * "Saathi", the copyright is hardcoded to 2025, and one of them makes a
 * returns promise the others do not. Changing anything global means editing
 * eleven files and missing one.
 *
 * EMAIL IS NOT THE WEB
 * Tables, inline styles, no flexbox, no grid, no external stylesheet, no web
 * font. Outlook renders with Word's engine and ignores most of CSS; Gmail
 * strips <style> blocks in some clients. Everything here is the boring subset
 * that renders the same in Outlook 2016, Gmail, and iOS Mail.
 *
 * DARK MODE
 * Gmail and Outlook forcibly invert colours in dark mode and there is no
 * reliable opt-out. Rather than fight it, the palette is chosen so that
 * inversion still reads: dark text on light panels, no white text on a light
 * background, and the brand colour only ever as a background behind white.
 */

export type EmailLocale = 'en' | 'bn';

/** Brand palette, matching the website. */
const BRAND = {
    plum: '#4e2770',
    plumDark: '#3b1d55',
    leaf: '#91C843',
    ink: '#1c1917',
    body: '#44403c',
    muted: '#78716c',
    hairline: '#e7e5e4',
    canvas: '#f5f4f2',
    panel: '#ffffff',
} as const;

const LOGO = 'https://api.digigramventures.com/assets/images/email-logo-header.png';
const SUPPORT = 'info@digigramventures.com';

/**
 * How to address someone whose name we do not have.
 *
 * 121 of 425 accounts have no `full_name`, and the old templates interpolate it
 * straight into "Dear ${data.fullName}," — so those people received "Dear ,".
 * A greeting with no name is better than a greeting with a hole in it.
 */
export function greeting(fullName: string | null | undefined, locale: EmailLocale): string {
    const name = (fullName ?? '').trim();
    if (locale === 'bn') return name ? `প্রিয় ${escapeHtml(name)},` : 'প্রিয় গ্রাহক,';
    return name ? `Dear ${escapeHtml(name)},` : 'Hello,';
}

/**
 * Every interpolated value goes through this.
 *
 * Names, project titles and remarks are user-supplied and land inside HTML. The
 * old templates interpolate them raw, so a name containing `<` breaks the
 * layout — and the rendering path is `eval()` of a template literal, which is
 * not somewhere to be relaxed about input.
 */
export function escapeHtml(value: unknown): string {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export type ShellOptions = {
    locale: EmailLocale;
    /** Shown in the inbox list after the subject. Never rendered in the body. */
    preheader: string;
    /** Body rows, already wrapped in <tr><td>. Use the helpers below. */
    body: string;
};

/**
 * A one-line summary the inbox shows next to the subject.
 *
 * Without one, clients pull the first text they find — which for the old
 * templates is the alt text of the logo, so every email previewed as
 * "Shathi Logo". It is hidden in the rendered message by being zero-height and
 * transparent; the trailing entities stop clients padding it with body copy.
 */
function preheaderBlock(text: string): string {
    return `<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${escapeHtml(text)}${'&#847;&zwnj;&nbsp;'.repeat(60)}</div>`;
}

export function paragraph(html: string, extra = ''): string {
    return `<tr><td style="padding:0 0 16px;font-size:16px;line-height:1.65;color:${BRAND.body};${extra}">${html}</td></tr>`;
}

export function heading(text: string): string {
    return `<tr><td style="padding:0 0 12px;font-size:22px;line-height:1.35;font-weight:700;color:${BRAND.ink};">${escapeHtml(text)}</td></tr>`;
}

/**
 * A bulletproof-ish button.
 *
 * Outlook ignores padding on <a>, so the clickable area is a table cell with
 * the background on it and the <a> filling it. Not a VML button: those break in
 * dark mode and every client that matters handles this fine.
 */
export function button(label: string, href: string): string {
    return `<tr><td style="padding:8px 0 24px;">
      <table border="0" cellpadding="0" cellspacing="0" role="presentation"><tr>
        <td align="center" bgcolor="${BRAND.plum}" style="border-radius:6px;">
          <a href="${escapeHtml(href)}" style="display:inline-block;padding:13px 26px;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:6px;">${escapeHtml(label)}</a>
        </td>
      </tr></table>
    </td></tr>`;
}

/** A large, letter-spaced code. Monospace so 0 and O are distinguishable. */
export function codeBlock(code: string): string {
    return `<tr><td style="padding:4px 0 20px;">
      <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%"><tr>
        <td align="center" bgcolor="${BRAND.canvas}" style="border:1px solid ${BRAND.hairline};border-radius:8px;padding:22px 12px;">
          <span style="font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:34px;font-weight:700;letter-spacing:9px;color:${BRAND.ink};">${escapeHtml(code)}</span>
        </td>
      </tr></table>
    </td></tr>`;
}

/** Label/value rows — bank details, booking summaries. */
export function detailRows(rows: Array<[string, string]>): string {
    const cells = rows
        .map(
            ([label, value], i) => `<tr>
        <td style="padding:10px 14px;font-size:14px;color:${BRAND.muted};${i ? `border-top:1px solid ${BRAND.hairline};` : ''}white-space:nowrap;">${escapeHtml(label)}</td>
        <td style="padding:10px 14px;font-size:15px;font-weight:600;color:${BRAND.ink};${i ? `border-top:1px solid ${BRAND.hairline};` : ''}text-align:right;">${escapeHtml(value)}</td>
      </tr>`,
        )
        .join('');
    return `<tr><td style="padding:0 0 20px;">
      <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%" style="background:${BRAND.canvas};border:1px solid ${BRAND.hairline};border-radius:8px;">${cells}</table>
    </td></tr>`;
}

/** A quieter aside — security notes, "you can ignore this". */
export function note(html: string): string {
    return `<tr><td style="padding:4px 0 16px;font-size:14px;line-height:1.6;color:${BRAND.muted};border-left:3px solid ${BRAND.hairline};padding-left:14px;">${html}</td></tr>`;
}

export function spacer(px = 8): string {
    return `<tr><td style="height:${px}px;line-height:${px}px;font-size:0;">&nbsp;</td></tr>`;
}

/**
 * Wraps body rows in the full document.
 *
 * The year is computed, not written down: the old templates all say "© 2025"
 * and would have said so through 2026 and beyond.
 */
export function renderShell({ locale, preheader, body }: ShellOptions): string {
    const bn = locale === 'bn';
    const year = new Date().getFullYear();

    const footerLine = bn
        ? `প্রশ্ন আছে? লিখুন <a href="mailto:${SUPPORT}" style="color:#ffffff;">${SUPPORT}</a>`
        : `Questions? Write to <a href="mailto:${SUPPORT}" style="color:#ffffff;">${SUPPORT}</a>`;

    const rights = bn
        ? `© ${year} ডিজিগ্রাম ভেঞ্চারস লিমিটেড। সর্বস্বত্ব সংরক্ষিত।`
        : `© ${year} DigiGram Ventures Ltd. All rights reserved.`;

    return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="${bn ? 'bn' : 'en'}">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<title>Shathi</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.canvas};">
${preheaderBlock(preheader)}
<table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%" style="background:${BRAND.canvas};">
  <tr><td align="center" style="padding:24px 12px;">

    <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="600" style="width:100%;max-width:600px;background:${BRAND.panel};border-radius:12px;overflow:hidden;">

      <tr><td align="center" bgcolor="${BRAND.plum}" style="padding:26px 20px;">
        <img src="${LOGO}" width="140" alt="Shathi" style="display:block;width:140px;max-width:60%;height:auto;border:0;" />
      </td></tr>

      <tr><td style="height:4px;line-height:4px;font-size:0;background:${BRAND.leaf};">&nbsp;</td></tr>

      <tr><td style="padding:34px 30px 10px;">
        <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%">
${body}
        </table>
      </td></tr>

      <tr><td style="padding:0 30px 30px;">
        <table border="0" cellpadding="0" cellspacing="0" role="presentation" width="100%">
          <tr><td style="border-top:1px solid ${BRAND.hairline};padding-top:18px;font-size:15px;line-height:1.6;color:${BRAND.body};">
            ${bn ? 'শুভেচ্ছান্তে,' : 'Warm regards,'}<br /><strong style="color:${BRAND.ink};">${bn ? 'সাথী টিম' : 'The Shathi Team'}</strong>
          </td></tr>
        </table>
      </td></tr>

      <tr><td align="center" bgcolor="${BRAND.plumDark}" style="padding:20px 24px;font-size:12px;line-height:1.7;color:#e9e4f0;">
        ${footerLine}<br />${rights}
      </td></tr>

    </table>

  </td></tr>
</table>
</body>
</html>`;
}
