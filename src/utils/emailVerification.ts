import crypto from 'crypto';
import { Op } from 'sequelize';
import { EmailVerification, User } from '@/models/__associations';
import type { EmailVerificationModel } from '@/models/EmailVerification';
import type { UserModel } from '@/models/User';
import sendEmail from '@/utils/SendEmail';
import {
    EMAIL_VERIFICATION_EXPIRY,
    EMAIL_VERIFICATION_MAX_ATTEMPTS,
    EMAIL_VERIFICATION_RESEND_COOLDOWN,
    EMAIL_FROM,
    WEB_BASE_URL,
} from '@/config/constants';
import { renderEmailVerificationCode } from '@/notifications/renderEmailVerification';

/**
 * Proving that somebody owns an email address.
 *
 * WHY THIS IS NOT PART OF THE NOTIFICATION QUEUE
 * Two reasons, both fatal:
 *
 *   1. `generateNotification` refuses to email an address unless
 *      `emailVerified === 'yes'`. A verification email is by definition sent to
 *      an unverified address, so it would never go out.
 *   2. The queue drains on a 30-second timer. Somebody staring at a code box
 *      would wait up to half a minute for the code, and conclude it is broken.
 *
 * So this sends directly through SES. It is the one email in the system that
 * does, and that is deliberate.
 *
 * WHAT A SUCCESSFUL VERIFICATION IS ALLOWED TO DO
 * Set `email_verified = 'yes'` on the account that requested it, and nothing
 * else. It never merges accounts and never moves records — a merge additionally
 * requires proof of the *phone* on the other account, and that decision lives
 * in the merge route.
 */

const CODE_LENGTH = 6;

/** Addresses are compared lower-cased and trimmed; migration 010 indexes them that way. */
export function normaliseEmail(value: string): string {
    return value.trim().toLowerCase();
}

/**
 * Deliberately permissive. Address syntax is famously hard to validate and a
 * regex that rejects a valid address is worse than one that accepts an invalid
 * one — the code never arrives either way, and only the real owner can complete
 * the flow.
 */
export function looksLikeEmail(value: string): boolean {
    const email = normaliseEmail(value);
    return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function sha256(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
}

/** Salted with the address, so the same code for two addresses differs. */
function hashCode(email: string, code: string): string {
    return sha256(`${normaliseEmail(email)}:${code}`);
}

function generateCode(): string {
    // Uniform and unpredictable; Math.random is neither.
    return String(crypto.randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, '0');
}

function timingSafeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
}

export type IssueResult =
    | { ok: true; expiresInSeconds: number }
    | { ok: false; code: 'INVALID_EMAIL' | 'TAKEN' | 'COOLDOWN' | 'SEND_FAILED'; message: string; retryAfterSeconds?: number };

/**
 * Issues a challenge for `rawEmail` on behalf of `user`, and sends it.
 *
 * REFUSES AN ADDRESS THAT BELONGS TO A LIVE ACCOUNT.
 * Not because verifying it would be unsafe — the code only reaches the real
 * owner — but because succeeding would produce two live accounts on one
 * address, which migration 010 forbids at the database level. That case is a
 * *merge*, and the caller is told so explicitly rather than being handed a
 * constraint violation.
 */
export async function issueEmailVerification(
    user: UserModel,
    rawEmail: string,
    locale: 'en' | 'bn' = 'en',
): Promise<IssueResult> {
    const email = normaliseEmail(rawEmail);

    if (!looksLikeEmail(email)) {
        return { ok: false, code: 'INVALID_EMAIL', message: 'Enter a valid email address.' };
    }

    const takenByAnother = await User.findOne({
        where: {
            email,
            status: ['active', 'inactive'],
            idUsers: { [Op.not]: user.idUsers },
        },
    });
    if (takenByAnother) {
        return {
            ok: false,
            code: 'TAKEN',
            message: 'Another Shathi account already uses this email address.',
        };
    }

    // One live challenge per user, with a resend cooldown, so this cannot be
    // used to send mail at somebody.
    const recent = await EmailVerification.findOne({
        where: { idUsers: user.idUsers, consumedAt: null, expiresAt: { [Op.gt]: new Date() } },
        order: [['createdAt', 'DESC']],
    });

    if (recent) {
        const ageSeconds = (Date.now() - new Date(recent.createdAt).getTime()) / 1000;
        if (ageSeconds < EMAIL_VERIFICATION_RESEND_COOLDOWN) {
            return {
                ok: false,
                code: 'COOLDOWN',
                message: 'A code was just sent. Check your inbox, including spam.',
                retryAfterSeconds: Math.ceil(EMAIL_VERIFICATION_RESEND_COOLDOWN - ageSeconds),
            };
        }
        recent.consumedAt = new Date();
        await recent.save();
    }

    const code = generateCode();
    const token = crypto.randomBytes(32).toString('hex');

    await EmailVerification.create({
        idUsers: user.idUsers,
        email,
        tokenHash: sha256(token),
        codeHash: hashCode(email, code),
        expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_EXPIRY),
        attempts: 0,
        consumedAt: null,
    } as never);

    const link = `${WEB_BASE_URL}/account/email/verify?token=${token}`;
    const { subject, html, text } = renderEmailVerificationCode({
        fullName: user.fullName ?? null,
        code,
        link,
        expiresInMinutes: Math.round(EMAIL_VERIFICATION_EXPIRY / 60000),
        locale,
    });

    const response = await sendEmail({
        from: EMAIL_FROM,
        to: [email],
        subject,
        htmlBody: html,
        textBody: text,
    });

    // sendEmail swallows its errors and returns the error object, so a failure
    // is only visible as a missing MessageId. Without this check the caller
    // would tell somebody to check an inbox nothing was sent to.
    if (!response || !('MessageId' in response)) {
        return {
            ok: false,
            code: 'SEND_FAILED',
            message: 'Could not send the email. Please try again in a moment.',
        };
    }

    return { ok: true, expiresInSeconds: Math.floor(EMAIL_VERIFICATION_EXPIRY / 1000) };
}

export type VerifyResult =
    | { ok: true; email: string; user: UserModel }
    | { ok: false; code: 'INVALID' | 'EXPIRED' | 'TOO_MANY' | 'TAKEN'; message: string };

async function completeVerification(
    record: EmailVerificationModel,
): Promise<VerifyResult> {
    // Re-check at the moment of writing: the address may have been claimed by
    // another account between issuing the challenge and completing it, and the
    // unique index would turn that into a 500 rather than a clear message.
    const takenByAnother = await User.findOne({
        where: {
            email: record.email,
            status: ['active', 'inactive'],
            idUsers: { [Op.not]: record.idUsers },
        },
    });
    if (takenByAnother) {
        return {
            ok: false,
            code: 'TAKEN',
            message: 'Another Shathi account claimed this email address in the meantime.',
        };
    }

    const user = await User.findOne({
        where: { idUsers: record.idUsers, status: ['active', 'inactive'] },
    });
    if (!user) {
        return { ok: false, code: 'INVALID', message: 'Account not found.' };
    }

    record.consumedAt = new Date();
    await record.save();

    user.email = record.email;
    user.emailVerified = 'yes';
    await user.save();

    return { ok: true, email: record.email, user };
}

/** Verifies by the link token. */
export async function verifyEmailToken(token: string): Promise<VerifyResult> {
    if (!token || typeof token !== 'string') {
        return { ok: false, code: 'INVALID', message: 'This link is not valid.' };
    }

    const record = await EmailVerification.findOne({
        where: { tokenHash: sha256(token), consumedAt: null },
        order: [['createdAt', 'DESC']],
    });

    if (!record) {
        return { ok: false, code: 'INVALID', message: 'This link is not valid or has already been used.' };
    }
    if (new Date(record.expiresAt).getTime() < Date.now()) {
        return { ok: false, code: 'EXPIRED', message: 'This link has expired. Request a new one.' };
    }

    return completeVerification(record);
}

/**
 * Verifies by the 6-digit code, for a specific user.
 *
 * Scoped to `idUsers` so a code cannot be replayed against a different account,
 * and attempt-counted so six digits cannot be guessed across many requests.
 */
export async function verifyEmailCode(idUsers: number, code: string): Promise<VerifyResult> {
    const record = await EmailVerification.findOne({
        where: { idUsers, consumedAt: null },
        order: [['createdAt', 'DESC']],
    });

    if (!record) {
        return { ok: false, code: 'INVALID', message: 'No code is waiting. Request a new one.' };
    }
    if (new Date(record.expiresAt).getTime() < Date.now()) {
        return { ok: false, code: 'EXPIRED', message: 'That code has expired. Request a new one.' };
    }
    if (record.attempts >= EMAIL_VERIFICATION_MAX_ATTEMPTS) {
        return { ok: false, code: 'TOO_MANY', message: 'Too many incorrect attempts. Request a new code.' };
    }

    if (!timingSafeEqual(record.codeHash, hashCode(record.email, String(code ?? '')))) {
        record.attempts += 1;
        // Burn it once the budget is spent, so the remaining guesses cannot be
        // spread across separate requests.
        if (record.attempts >= EMAIL_VERIFICATION_MAX_ATTEMPTS) record.consumedAt = new Date();
        await record.save();

        const left = EMAIL_VERIFICATION_MAX_ATTEMPTS - record.attempts;
        return {
            ok: false,
            code: 'INVALID',
            message: left > 0 ? `Incorrect code. ${left} attempts left.` : 'Incorrect code.',
        };
    }

    return completeVerification(record);
}

/** True when this account has a currently-valid, unconsumed challenge. */
export async function hasPendingVerification(idUsers: number): Promise<string | null> {
    const record = await EmailVerification.findOne({
        where: { idUsers, consumedAt: null, expiresAt: { [Op.gt]: new Date() } },
        order: [['createdAt', 'DESC']],
    });
    return record ? record.email : null;
}
