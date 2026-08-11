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
} from '@/config/constants';
import { User, AppOtp } from '@/models/__associations';
import SendSms from '@/utils/SendSms';
import { withCors } from '@/utils/auth';
import { needsProfile, bookingBlockers } from '@/utils/profileCompletion';

/**
 * Phone + OTP sign-in **for the website only**.
 *
 *   POST { phone }       → send a code, but only to a number that already has
 *                          an account
 *   PUT  { phone, otp }  → verify → { token, user }
 *
 * WHY THIS EXISTS RATHER THAN REUSING /api/otp
 * `/api/otp` creates the account when the phone number is unknown — that is how
 * the mobile app registers people, and it must keep doing so. The website has
 * the opposite requirement: **no signup from the web.** Only someone who has
 * already registered in the Shathi app can sign in, with the same credentials.
 * Pointing the site at `/api/otp` would silently register anyone who typed a
 * phone number into the login form.
 *
 * `/api/otp` is therefore left exactly as it is, and the site calls this route.
 * The two share no code on purpose: the shipped app treats a 401 as a forced
 * logout, so a refactor that touched `/api/otp` could eject live users
 * mid-session. The duplicated helpers below are ~15 lines and are annotated in
 * both places; if you change the hashing here, change it there too.
 *
 * Also unlike `/api/otp`, this route never attaches or changes a phone number
 * on an existing session — the website has no such flow, and accepting one here
 * would be an account-takeover surface reachable without re-authentication.
 */

const BD_PHONE = /^(\+88)?(01[3-9]\d{8})$/;

/** Must stay identical to the same function in /api/otp.ts. */
function hashOtp(phone: string, otp: string): string {
    return crypto.createHash('sha256').update(`${phone}:${otp}`).digest('hex');
}

/** Must stay identical to the same function in /api/otp.ts. */
function timingSafeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
}

function generateOtp(): string {
    return String(crypto.randomInt(1000, 10000));
}

function signToken(idUsers: number, userType: string | undefined): string {
    return jwt.sign({ idUsers: Number(idUsers), userType: userType ?? 'user' }, JWT_SECRET, {
        expiresIn: '30d',
    });
}

/**
 * The projection returned to the website.
 *
 * An explicit allowlist rather than the whole row: the site needs enough to
 * render the account area and decide what the profile is still missing, and
 * nothing else. Notably absent are `googleId` / `appleId` and the raw NID
 * image filenames — the verification *status* is what the UI acts on.
 */
const WEB_USER_ATTRIBUTES = [
    'idUsers',
    'fullName',
    'fullNameBn',
    'gender',
    'email',
    'phoneNumber',
    'userType',
    'profileImage',
    'dateOfBirth',
    'emailVerified',
    'phoneVerified',
    'nidVerified',
    'nidVerificationStatus',
    'status',
] as const;

async function handler(req: NextApiRequest, res: NextApiResponse) {
    /* ------------------------------------------------------------ request -- */
    if (req.method === 'POST') {
        const { phone } = req.body ?? {};

        if (!phone) {
            return res.status(400).json({ success: false, message: 'Phone number is required' });
        }
        if (!BD_PHONE.test(phone)) {
            return res.status(400).json({ success: false, message: 'Invalid phone number' });
        }

        /**
         * The no-signup rule, enforced before any SMS is sent.
         *
         * This does tell an anonymous caller whether a number is registered.
         * That is a deliberate trade: the product requires telling people to go
         * and register in the app, and a generic "code sent" for an unknown
         * number would strand them waiting for an SMS that can never arrive.
         * The rate limit below is what keeps it from being a cheap enumeration
         * oracle, and no personal data is returned either way.
         */
        const existing = await User.findOne({
            where: { phoneNumber: phone },
            attributes: ['idUsers', 'status'],
        });

        /*
         * A deleted account is the one case still refused outright.
         *
         * Signup on the web used to be blocked here: an unknown number was
         * answered with NOT_REGISTERED and told to install the app. That rule
         * is gone — registering on the website is now allowed, and the code is
         * sent whether or not the number is known.
         *
         * The financial bar did not move. `bookingBlockers` still requires a
         * verified NID before a booking can be placed, so a number that signs
         * up here can browse and fill in a profile and nothing more.
         *
         * A useful side effect: the response no longer differs between a known
         * and an unknown number, so this endpoint has stopped being a way to
         * test whether a given phone number has a Shathi account.
         */
        if (existing && existing.status === 'deleted') {
            return res.status(403).json({
                success: false,
                code: 'ACCOUNT_DELETED',
                message:
                    'This number belonged to an account that was deleted. Contact info@digigramventures.com to restore it.',
            });
        }

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
            recent.consumedAt = new Date();
            await recent.save();
        }

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
        const { phone, otp } = req.body ?? {};

        if (!phone || !otp) {
            return res
                .status(400)
                .json({ success: false, message: 'Phone number and OTP is required' });
        }

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
            if (record.attempts >= OTP_MAX_ATTEMPTS) record.consumedAt = new Date();
            await record.save();

            const left = OTP_MAX_ATTEMPTS - record.attempts;
            return res.status(400).json({
                success: false,
                message: left > 0 ? `Invalid OTP. ${left} attempts left.` : 'Invalid OTP',
            });
        }

        // The account is looked up *before* the code is consumed, so a race
        // between the two checks cannot burn a valid code for nothing.
        let user = await User.findOne({ where: { phoneNumber: phone } });

        if (user && user.status === 'deleted') {
            return res.status(403).json({
                success: false,
                code: 'ACCOUNT_DELETED',
                message: 'This number belonged to an account that was deleted.',
            });
        }

        let isNew = false;

        if (!user) {
            /*
             * First sight of this number: create the account.
             *
             * Proving the number by SMS *is* the registration. `phoneVerified`
             * is set here and nowhere else on this path, because this is the
             * only moment we know the code reached the handset.
             *
             * Name and gender are not asked for yet — the client sends them to
             * the profile step immediately, and `needsProfile` in the response
             * is what tells it to. Creating the row first means a signup that
             * is abandoned at the name screen can be resumed by signing in
             * again rather than starting over.
             */
            user = new User();
            user.phoneNumber = phone;
            user.phoneVerified = 'yes';
            await user.save();
            isNew = true;
        }

        record.consumedAt = new Date();
        await record.save();

        const safe: Record<string, unknown> = {};
        for (const key of WEB_USER_ATTRIBUTES) {
            safe[key] = (user as unknown as Record<string, unknown>)[key] ?? null;
        }

        return res.status(200).json({
            success: true,
            isNew,
            needsProfile: needsProfile(user),
            bookingBlockers: bookingBlockers(user),
            token: signToken(user.idUsers as number, user.userType),
            user: safe,
        });
    }

    return res.status(405).json({ success: false, message: 'Method not allowed' });
}

export default withCors(handler);
