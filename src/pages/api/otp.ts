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
 *     configured through env, so it can be off in production;
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

function isReviewLogin(phone: string, otp: string): boolean {
    return (
        OTP_REVIEW_ENABLED &&
        OTP_REVIEW_PHONE !== '' &&
        OTP_REVIEW_CODE !== '' &&
        phone === OTP_REVIEW_PHONE &&
        timingSafeEqual(otp, OTP_REVIEW_CODE)
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
        const { phone, otp } = req.body;

        if (!phone || !otp) {
            return res
                .status(400)
                .json({ success: false, message: 'Phone number and OTP is required' });
        }

        if (!isReviewLogin(phone, String(otp))) {
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
