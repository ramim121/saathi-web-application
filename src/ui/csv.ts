/**
 * Saves rows as a CSV file from the browser.
 *
 * A cell starting with = + - or @ is prefixed with an apostrophe: names and
 * notes come from users, and Excel would otherwise run them as formulas.
 */
const cell = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'number') return String(value);
    let text = String(value);
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export function downloadCsv(filename: string, headers: string[], rows: unknown[][]) {
    const body = [headers, ...rows].map((row) => row.map(cell).join(',')).join('\r\n');
    // The byte-order mark makes Excel read Bangla names as UTF-8.
    const url = URL.createObjectURL(new Blob(['﻿', body], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}
