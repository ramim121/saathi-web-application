import { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { Op } from 'sequelize';
import _ from 'await-to-js';
import {
    JWT_SECRET,
    OTP_EXPIRY,
    OTP_MAX_ATTEMPTS,
    OTP_RESEND_COOLDOWN,
    OTP_REVIEW_ENABLED,
    OTP_REVIEW_PHONE,
    OTP_REVIEW_CODE,
} from '@/config/constants';
import {
    User,
    ProjectInvestor,
    ProjectPartner,
    Project,
    UserBank,
    Bank,
    BankBranch,
    AppOtp,
} from '@/models/__associations';
import SendSms from '@/utils/SendSms';
import { withCors, readAuth } from '@/utils/auth';

/**
 * Phone + OTP authentication — the sign-in path for the apps and the website.
 *
 *   POST { phone }        → generate, SMS, store
 *   PUT  { phone, otp }   → verify → { token, user }
 *
 * Changed from the previous implementation:
 *   - codes are persisted in `app_otps` instead of a module-level object, so
 *     they survive deploys and work across more than one instance;
 *   - only a SHA-256 digest is stored, so a database dump does not leak live
 *     passcodes;
 *   - the hardcoded `01966662633` / `7910` bypass is gone. A review-account
 *     bypass still exists but must be switched on with OTP_REVIEW_ENABLED and
 *     configured through env. It has to be ON in production while a build is
 *     with App Store or Play review — the reviewer cannot receive an SMS — and
 *     should be turned off again once the build is approved. See
 *     "REVIEW LOGIN" below;
 *   - wrong attempts are counted and the code is burned after
 *     OTP_MAX_ATTEMPTS, instead of being retryable until it expires;
 *   - the verify step compares with a timing-safe equality check.
 *
 * NOTE: the OTP is 4 digits, which is 10,000 possibilities. The attempt
 * counter is what makes that acceptable — do not remove it. Six digits would
 * be better if the SMS copy can change.
 */

const BD_PHONE = /^(\+88)?(01[3-9]\d{8})$/;

function generateOtp(): string {
    // crypto.randomInt is uniform and unpredictable; Math.random is neither.
    return String(crypto.randomInt(1000, 10000));
}

function hashOtp(phone: string, otp: string): string {
    // Salted with the phone number so the same code for two numbers does not
    // produce the same digest.
    return crypto.createHash('sha256').update(`${phone}:${otp}`).digest('hex');
}

function timingSafeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
}

/* ----------------------------------------------------------- REVIEW LOGIN --
 *
 * Apple and Google sign in with a demo account, and a reviewer cannot read an
 * SMS sent to a Bangladeshi number. So one configured number accepts one
 * configured code instead of a texted one.
 *
 * That makes the code a standing password for a real account, on an endpoint
 * anyone can call, and the app's OTP field takes exactly four digits — ten
 * thousand possibilities. Left as a plain comparison it could be guessed by
 * script in under a minute. Hence two limits on wrong review codes:
 *
 *   - per caller, 5 an hour — so one person mistyping is told to wait without
 *     shutting anyone else out;
 *   - overall, 10 a day — the one that actually protects the account. It does
 *     not depend on knowing who the caller is, which matters because
 *     production's nginx does not set X-Real-IP (staging's does), so there the
 *     caller key can be shared or spoofed. Ten guesses a day at a four-digit
 *     code is a 0.1% chance per day.
 *
 * The overall limit means somebody determined can lock the reviewer out for up
 * to a day. That is the lesser harm: a locked-out review is retried, a
 * taken-over account is not. Turning the bypass off once a build is approved
 * closes the window entirely.
 *
 * Counters live in this process's memory. Each environment runs one process,
 * and a restart is not something a caller can trigger.
 */

/** `+8801XXXXXXXXX` and `01XXXXXXXXX` are the same number. */
function normalisePhone(phone: unknown): string {
    return String(phone ?? '').trim().replace(/^\+?88(?=01)/, '');
}

/** Is this the configured review number, with the bypass switched on? */
function isReviewPhone(phone: unknown): boolean {
    return (
        OTP_REVIEW_ENABLED &&
        OTP_REVIEW_PHONE !== '' &&
        OTP_REVIEW_CODE !== '' &&
        normalisePhone(phone) === normalisePhone(OTP_REVIEW_PHONE)
    );
}

const REVIEW_MAX_FAILS_PER_CALLER = 5;
const REVIEW_CALLER_WINDOW_MS = 60 * 60 * 1000;
const REVIEW_MAX_FAILS_OVERALL = 10;
const REVIEW_OVERALL_WINDOW_MS = 24 * 60 * 60 * 1000;

const reviewFailsByCaller = new Map<string, number[]>();
let reviewFailsOverall: number[] = [];

function recent(times: number[], windowMs: number): number[] {
    const cutoff = Date.now() - windowMs;
    return times.filter((t) => t > cutoff);
}

/** "in 12 minutes" / "in about 9 hours" */
function waitText(seconds: number): string {
    const minutes = Math.ceil(seconds / 60);
    return minutes <= 90 ? `in ${minutes} minutes` : `in about ${Math.ceil(minutes / 60)} hours`;
}

/**
 * Who is calling, as well as can be told. Where nginx sets `X-Real-IP` (staging)
 * it overwrites whatever the client sent, so it is reliable. Where it does not
 * (production, today) the value may be absent or client-chosen — which only
 * weakens the per-caller limit; the overall limit does not use it.
 */
function callerOf(req: NextApiRequest): string {
    const real = req.headers['x-real-ip'];
    if (typeof real === 'string' && real) return real;
    const forwarded = req.headers['x-forwarded-for'];
    const chain = (Array.isArray(forwarded) ? forwarded.join(',') : forwarded ?? '').split(',');
    return chain[chain.length - 1]?.trim() || req.socket?.remoteAddress || 'unknown';
}

/** Seconds until this caller may try the review code again, or 0. */
function reviewBlockedFor(caller: string): number {
    const now = Date.now();
    reviewFailsOverall = recent(reviewFailsOverall, REVIEW_OVERALL_WINDOW_MS);
    const mine = recent(reviewFailsByCaller.get(caller) ?? [], REVIEW_CALLER_WINDOW_MS);
    if (mine.length) reviewFailsByCaller.set(caller, mine);
    else reviewFailsByCaller.delete(caller);

    // Each list is in time order, so the entry that has to expire before
    // another try is allowed is the one at [length - limit].
    let until = 0;
    if (mine.length >= REVIEW_MAX_FAILS_PER_CALLER) {
        until = Math.max(until, mine[mine.length - REVIEW_MAX_FAILS_PER_CALLER] + REVIEW_CALLER_WINDOW_MS);
    }
    if (reviewFailsOverall.length >= REVIEW_MAX_FAILS_OVERALL) {
        until = Math.max(until, reviewFailsOverall[reviewFailsOverall.length - REVIEW_MAX_FAILS_OVERALL] + REVIEW_OVERALL_WINDOW_MS);
    }
    return until > now ? Math.max(1, Math.ceil((until - now) / 1000)) : 0;
}

function noteReviewFailure(caller: string): void {
    const now = Date.now();
    reviewFailsByCaller.set(caller, [...recent(reviewFailsByCaller.get(caller) ?? [], REVIEW_CALLER_WINDOW_MS), now]);
    reviewFailsOverall = [...recent(reviewFailsOverall, REVIEW_OVERALL_WINDOW_MS), now];
    // Visible in the pm2 log, so a guessing attempt is noticed.
    console.warn(
        `[otp] wrong review code from ${caller} (${reviewFailsOverall.length} of ${REVIEW_MAX_FAILS_OVERALL} allowed in 24h)`,
    );
}

/**
 * `idUsers` is optional on the model type (it is absent until the row is
 * inserted), so it is narrowed here rather than at each call site — a token
 * signed with an undefined subject would authenticate as nobody.
 */
function signToken(idUsers: number | undefined, userType: string | undefined): string {
    if (idUsers === undefined || idUsers === null) {
        throw new Error('Cannot sign a token without a user id');
    }
    return jwt.sign({ idUsers: Number(idUsers), userType: userType ?? 'user' }, JWT_SECRET, {
        expiresIn: '30d',
    });
}

const USER_INCLUDES = [
    { model: UserBank, include: [Bank, BankBranch] },
    { model: ProjectInvestor, as: 'Investments', include: [Project] },
    { model: ProjectPartner, as: 'Partnerships', include: [Project] },
];

async function handler(req: NextApiRequest, res: NextApiResponse) {
    /* ------------------------------------------------------------ request -- */
    if (req.method === 'POST') {
        const { phone } = req.body;

        if (!phone) {
            return res.status(400).json({ success: false, message: 'Phone number is required' });
        }
        if (!BD_PHONE.test(phone)) {
            return res.status(400).json({ success: false, message: 'Invalid phone number' });
        }

        /*
         * The review number is never texted. Its code is fixed, so an SMS
         * would only cost money and reach whoever owns the SIM every time a
         * reviewer opens the app — and the resend cooldown below would answer
         * a reviewer's second tap with "please wait".
         */
        if (isReviewPhone(phone)) {
            return res.status(200).json({
                success: true,
                message: 'OTP sent successfully',
                expiresInSeconds: Math.floor(OTP_EXPIRY / 1000),
            });
        }

        // Rate limit: one live code per number, with a resend cooldown.
        const recent = await AppOtp.findOne({
            where: {
                phoneNumber: phone,
                consumedAt: null,
                expiresAt: { [Op.gt]: new Date() },
            },
            order: [['createdAt', 'DESC']],
        });

        if (recent) {
            const ageSeconds = (Date.now() - new Date(recent.createdAt).getTime()) / 1000;
            if (ageSeconds < OTP_RESEND_COOLDOWN) {
                return res.status(429).json({
                    success: false,
                    message: `Please wait ${Math.ceil(OTP_RESEND_COOLDOWN - ageSeconds)} seconds before requesting another code`,
                });
            }
            // Past the cooldown: invalidate the old code so only one is live.
            recent.consumedAt = new Date();
            await recent.save();
        }

        /*
         * Read-only, purely to choose the wording below.
         *
         * This route creates the account on first verify, so it has never
         * needed to know in advance whether the number is known. It still does
         * not gate on the answer — the flow is unchanged for the shipped app;
         * only the SMS wording differs.
         */
        const existing = await User.findOne({
            where: { phoneNumber: phone },
            attributes: ['idUsers'],
        });

        const otp = generateOtp();

        const [createErr] = await _(
            AppOtp.create({
                phoneNumber: phone,
                otpHash: hashOtp(phone, otp),
                expiresAt: new Date(Date.now() + OTP_EXPIRY),
                attempts: 0,
                consumedAt: null,
            } as never),
        );
        if (createErr) {
            return res.status(500).json({ success: false, message: 'Could not create OTP' });
        }

        /*
         * The wording depends on whether this number already has an account.
         *
         * One string used to serve both, so somebody signing in for the
         * hundredth time was greeted with "Welcome to SHATHI" — and, now that
         * the website registers people too, a genuinely new user got the same
         * message as a returning one with no hint that an account was about to
         * be created for them.
         */
        const isReturning = Boolean(existing);
        await SendSms(
            isReturning
                ? `Your SHATHI login code is ${otp}. It expires in ${Math.round(OTP_EXPIRY / 60000)} minutes. Never share it.`
                : `Welcome to SHATHI. Your code to finish signing up is ${otp}. It expires in ${Math.round(OTP_EXPIRY / 60000)} minutes. Never share it.`,
            phone,
        );

        return res.status(200).json({
            success: true,
            message: 'OTP sent successfully',
            expiresInSeconds: Math.floor(OTP_EXPIRY / 1000),
        });
    }

    /* ------------------------------------------------------------- verify -- */
    if (req.method === 'PUT') {
        const { otp } = req.body;
        let { phone } = req.body;

        if (!phone || !otp) {
            return res
                .status(400)
                .json({ success: false, message: 'Phone number and OTP is required' });
        }

        const reviewLogin = isReviewPhone(phone);

        if (reviewLogin) {
            // The review code signs in; it never attaches the number to
            // whichever account happens to be signed in already.
            if (readAuth(req)) {
                return res.status(400).json({ success: false, message: 'Invalid OTP' });
            }

            const caller = callerOf(req);
            const wait = reviewBlockedFor(caller);
            if (wait > 0) {
                return res.status(429).json({
                    success: false,
                    message: `Too many incorrect attempts. Try again ${waitText(wait)}.`,
                });
            }
            if (!timingSafeEqual(String(otp), OTP_REVIEW_CODE)) {
                noteReviewFailure(caller);
                return res.status(400).json({ success: false, message: 'Invalid OTP' });
            }

            // Look the account up by the number as configured, so typing it
            // with a +88 prefix reaches the same account instead of creating
            // a second one.
            phone = OTP_REVIEW_PHONE;
        } else {
            const record = await AppOtp.findOne({
                where: { phoneNumber: phone, consumedAt: null },
                order: [['createdAt', 'DESC']],
            });

            if (!record) {
                return res.status(400).json({ success: false, message: 'Invalid OTP' });
            }
            if (new Date(record.expiresAt).getTime() < Date.now()) {
                return res.status(400).json({ success: false, message: 'OTP expired. try again' });
            }
            if (record.attempts >= OTP_MAX_ATTEMPTS) {
                return res.status(429).json({
                    success: false,
                    message: 'Too many incorrect attempts. Request a new code.',
                });
            }

            if (!timingSafeEqual(record.otpHash, hashOtp(phone, String(otp)))) {
                record.attempts += 1;
                // Burn the code once the budget is spent, so it cannot be
                // brute-forced across separate requests.
                if (record.attempts >= OTP_MAX_ATTEMPTS) record.consumedAt = new Date();
                await record.save();

                const left = OTP_MAX_ATTEMPTS - record.attempts;
                return res.status(400).json({
                    success: false,
                    message: left > 0 ? `Invalid OTP. ${left} attempts left.` : 'Invalid OTP',
                });
            }

            record.consumedAt = new Date();
            await record.save();
        }

        const auth = readAuth(req);

        /* --- no session: sign in, creating the account on first use --- */
        if (!auth) {
            let user = await User.findOne({
                where: { phoneNumber: phone },
                include: USER_INCLUDES,
            });

            if (user && user.status === 'deleted') {
                return res.status(400).json({ success: false, message: 'User not found' });
            }

            if (!user) {
                user = new User();
                user.phoneNumber = phone;
                user.phoneVerified = 'yes';
                await user.save();
            }

            return res.status(200).json({
                success: true,
                token: signToken(user.idUsers, user.userType),
                user,
            });
        }

        /* --- signed in: attach or change the phone on this account --- */
        const user = await User.findOne({
            where: { idUsers: auth.idUsers, status: ['active', 'inactive'] },
        });
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const takenByAnother = await User.findOne({
            where: { phoneNumber: phone, idUsers: { [Op.not]: user.idUsers } },
        });
        if (takenByAnother) {
            return res.status(400).json({ success: false, message: 'Phone number already exists' });
        }

        user.phoneNumber = phone;
        user.phoneVerified = 'yes';

        const [saveErr] = await _(user.save());
        if (saveErr) {
            return res.status(400).json({ success: false, message: 'Error updating user' });
        }

        return res.status(200).json({
            success: true,
            token: signToken(user.idUsers, user.userType),
            user,
        });
    }

    return res.status(405).json({ success: false, message: 'Method not allowed' });
}

export default withCors(handler);
