/**
 * Outbound-message sandbox for servers that are not production.
 *
 * WHY THIS EXISTS
 * Staging (api-test) is loaded with a copy of production data so the app can
 * be tested against real bookings. Every phone number, email address and
 * device token in that copy belongs to a real investor, and staging has live
 * SMS and SES keys. Without a sandbox, anything that sends a message on
 * staging — an admin confirming a booking, the dashboard's notification
 * sweep, a sign-in code typed for the wrong number — reaches that person.
 *
 * HOW IT WORKS
 * `NOTIFY_ALLOWLIST` turns the sandbox on.
 *  - Unset (production): every message is sent exactly as before.
 *  - Set: only listed recipients receive anything. Entries are
 *    comma-separated: phone numbers (matched on their last 10 digits, so
 *    01712…, 8801712… and +8801712… are the same), email addresses, and FCM
 *    topic names. Push to individual device tokens is never sent, because a
 *    token cannot be matched to a person here.
 *  - Set but empty: nothing is sent at all.
 * Every message held back is logged with the recipient masked and without
 * its body.
 */

const RAW = process.env.NOTIFY_ALLOWLIST;

/** True on a server where NOTIFY_ALLOWLIST is present, even if empty. */
export const NOTIFY_SANDBOX = RAW !== undefined;

const ENTRIES = (RAW ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);

const phoneKey = (value: string): string => value.replace(/\D/g, '').slice(-10);
const isPhone = (entry: string): boolean => /^[+\d][\d\s-]{6,}$/.test(entry);

const ALLOWED_PHONES = new Set(ENTRIES.filter(isPhone).map(phoneKey));
const ALLOWED_EMAILS = new Set(ENTRIES.filter((e) => e.includes('@')).map((e) => e.toLowerCase()));
const ALLOWED_TOPICS = new Set(ENTRIES.filter((e) => !e.includes('@') && !isPhone(e)));

function mask(value: string): string {
    if (value.includes('@')) {
        const [name, domain] = value.split('@');
        return `${name.slice(0, 2)}***@${domain}`;
    }
    return value.length > 4 ? `${'*'.repeat(value.length - 3)}${value.slice(-3)}` : '***';
}

function held(kind: string, recipient: string): void {
    console.warn(`[notify-sandbox] ${kind} to ${mask(recipient)} held back (not in NOTIFY_ALLOWLIST)`);
}

/**
 * The receivers an SMS may go to. `receiver` may hold several numbers
 * separated by commas; the ones not on the list are dropped. Returns null when
 * nothing is left to send.
 */
export function allowSms(receiver: string): string | null {
    if (!NOTIFY_SANDBOX) return receiver;
    const kept: string[] = [];
    for (const number of String(receiver ?? '').split(',').map((n) => n.trim()).filter(Boolean)) {
        if (ALLOWED_PHONES.has(phoneKey(number))) kept.push(number);
        else held('SMS', number);
    }
    return kept.length ? kept.join(',') : null;
}

/** Whether an email may be sent to this address. */
export function allowEmail(address: string): boolean {
    if (!NOTIFY_SANDBOX) return true;
    if (address && ALLOWED_EMAILS.has(address.trim().toLowerCase())) return true;
    held('Email', address || '(none)');
    return false;
}

/** Whether a push may be sent to one device token. Never in the sandbox. */
export function allowDevicePush(token: string): boolean {
    if (!NOTIFY_SANDBOX) return true;
    held('Push', token ? token.slice(-6) : '(none)');
    return false;
}

/** Whether a push may be sent to an FCM topic. */
export function allowTopicPush(topic: string): boolean {
    if (!NOTIFY_SANDBOX) return true;
    if (ALLOWED_TOPICS.has(topic)) return true;
    console.warn(`[notify-sandbox] Push to topic ${topic} held back (not in NOTIFY_ALLOWLIST)`);
    return false;
}

if (NOTIFY_SANDBOX) {
    console.warn(
        `[notify-sandbox] ON: ${ALLOWED_PHONES.size} phone(s), ${ALLOWED_EMAILS.size} email(s), ` +
        `${ALLOWED_TOPICS.size} topic(s) allowed; everything else is held back.`,
    );
}
