import { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { Op } from 'sequelize';
import { JWT_SECRET, OTP_EXPIRY, OTP_MAX_ATTEMPTS, OTP_RESEND_COOLDOWN } from '@/config/constants';
import { User, AppOtp } from '@/models/__associations';
import { withCors, readAuth } from '@/utils/auth';
import SendSms from '@/utils/SendSms';
import {
    issueEmailVerification,
    verifyEmailCode,
    normaliseEmail,
} from '@/utils/emailVerification';
import { planMerge, applyMerge } from '@/utils/mergeAccounts';
import { needsProfile, bookingBlockers } from '@/utils/profileCompletion';

/**
 * Joining two accounts that belong to one person.
 *
 *   POST /api/v2/web/account/merge  { step: 'check',   channel, value }
 *   POST /api/v2/web/account/merge  { step: 'request', channel, value }
 *   POST /api/v2/web/account/merge  { step: 'confirm', channel, value, code }
 *
 * THE RULE: BOTH SIDES MUST BE PROVED, AND ONE PROOF IS NOT ENOUGH.
 *
 * The session proves the signed-in account — you only hold a token by having
 * passed an SMS code or a Google sign-in. The challenge in `request` proves the
 * *other* account's own channel. Only when both are in hand does anything move.
 *
 * This is the whole security model, so it is worth being blunt about the attack
 * it stops. If a merge could be triggered by an unverified attribute, then
 * typing someone else's phone number or address into your own profile would
 * pull their bookings, investments and bank details onto your account. Every
 * step below exists to make sure the person asking holds *both* mailboxes or
 * handsets, not just one and a claim about the other.
 *
 * WHY A SEPARATE CHALLENGE FROM `email/request`
 * That route refuses an address a live account already holds, because verifying
 * it onto the caller would break the unique index. Here the collision is the
 * entire point: the address is expected to belong to somebody, and proving it
 * is what authorises the merge rather than being blocked by it.
 */

const BD_PHONE = /^(\+88)?(01[3-9]\d{8})$/;

function hashOtp(phone: string, otp: string): string {
    return crypto.createHash('sha256').update(`${phone}:${otp}`).digest('hex');
}

function timingSafeEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
}

/** The live account holding `value` on `channel`, if any. */
async function findOther(channel: 'email' | 'phone', value: string) {
    const where =
        channel === 'email'
            ? { email: normaliseEmail(value) }
            : { phoneNumber: value };

    return User.findOne({ where: { ...where, status: ['active', 'inactive'] } });
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

    const auth = readAuth(req);
    if (!auth) {
        return res.status(401).json({ success: false, message: 'Sign in first' });
    }

    const me = await User.findOne({
        where: { idUsers: auth.idUsers, status: ['active', 'inactive'] },
    });
    if (!me) {
        return res.status(404).json({ success: false, message: 'User not found' });
    }

    const { step, channel, value, code, survivorId } = (req.body ?? {}) as {
        step?: string;
        channel?: 'email' | 'phone';
        value?: string;
        code?: string;
        survivorId?: number;
    };

    if (channel !== 'email' && channel !== 'phone') {
        return res.status(400).json({ success: false, message: 'channel must be email or phone' });
    }
    if (!value || typeof value !== 'string') {
        return res.status(400).json({ success: false, message: 'value is required' });
    }
    if (channel === 'phone' && !BD_PHONE.test(value)) {
        return res.status(400).json({ success: false, message: 'Invalid phone number' });
    }

    const other = await findOther(channel, value);

    if (!other) {
        return res.status(404).json({
            success: false,
            code: 'NO_SUCH_ACCOUNT',
            message:
                channel === 'email'
                    ? 'No Shathi account uses that email address.'
                    : 'No Shathi account uses that number.',
        });
    }
    if (other.idUsers === me.idUsers) {
        return res.status(400).json({
            success: false,
            code: 'SAME_ACCOUNT',
            message: 'That is already this account.',
        });
    }

    /* ------------------------------------------------------------ check -- */
    /*
     * What the merge would do, before any code is sent.
     *
     * Shown to the person so they agree to something they understand: which
     * account survives and how many records move. It reveals that an account
     * exists on that address — which they have just been told anyway by
     * NO_SUCH_ACCOUNT being absent — but no personal detail from it.
     */
    if (step === 'check') {
        const planned = await planMerge(me, other, survivorId);
        if (!planned.ok) {
            return res.status(409).json({ success: false, code: planned.code, message: planned.message });
        }
        return res.status(200).json({
            success: true,
            survivorId: planned.plan.survivorId,
            youAreSurvivor: planned.plan.survivorId === me.idUsers,
            recordsMoving: planned.plan.totalRows,
            channelToProve: channel,
        });
    }

    /* ---------------------------------------------------------- request -- */
    if (step === 'request') {
        if (channel === 'email') {
            // Deliberately issued against `other`, not `me`: this proves the
            // other account's address, and consuming it must not write that
            // address onto the caller.
            const issued = await issueEmailVerification(other, value, 'en');
            if (!issued.ok && issued.code !== 'TAKEN') {
                return res.status(issued.code === 'COOLDOWN' ? 429 : 400).json({
                    success: false,
                    code: issued.code,
                    message: issued.message,
                });
            }
            return res.status(200).json({
                success: true,
                message: 'A code was sent to that email address.',
            });
        }

        /*
         * Same throttle as the sign-in route, and for a sharper reason.
         *
         * `findOther` has already established that this number belongs to a
         * real account, so without a cooldown a signed-in caller could use this
         * endpoint to send unlimited SMS to any registered number — harassment
         * with our sender ID on it, at our cost.
         */
        const recent = await AppOtp.findOne({
            where: { phoneNumber: value, consumedAt: null, expiresAt: { [Op.gt]: new Date() } },
            order: [['createdAt', 'DESC']],
        });
        if (recent) {
            const ageSeconds = (Date.now() - new Date(recent.createdAt).getTime()) / 1000;
            if (ageSeconds < OTP_RESEND_COOLDOWN) {
                return res.status(429).json({
                    success: false,
                    code: 'COOLDOWN',
                    message: `Please wait ${Math.ceil(OTP_RESEND_COOLDOWN - ageSeconds)} seconds before asking for another code.`,
                });
            }
            recent.consumedAt = new Date();
            await recent.save();
        }

        const otp = String(crypto.randomInt(1000, 10000));
        await AppOtp.create({
            phoneNumber: value,
            otpHash: hashOtp(value, otp),
            expiresAt: new Date(Date.now() + OTP_EXPIRY),
            attempts: 0,
            consumedAt: null,
        } as never);
        await SendSms(`Your SHATHI account merge code is ${otp}`, value);

        return res.status(200).json({ success: true, message: 'A code was sent by SMS.' });
    }

    /* ---------------------------------------------------------- confirm -- */
    if (step === 'confirm') {
        if (!code) {
            return res.status(400).json({ success: false, message: 'code is required' });
        }

        if (channel === 'email') {
            // Scoped to `other.idUsers` — the challenge was issued for that
            // account, and a code must never be redeemable by a different one.
            const verified = await verifyEmailCode(other.idUsers as number, String(code));
            if (!verified.ok) {
                return res.status(verified.code === 'TOO_MANY' ? 429 : 400).json({
                    success: false,
                    code: verified.code,
                    message: verified.message,
                });
            }
        } else {
            const record = await AppOtp.findOne({
                where: { phoneNumber: value, consumedAt: null, expiresAt: { [Op.gt]: new Date() } },
                order: [['createdAt', 'DESC']],
            });
            if (!record) {
                return res.status(400).json({ success: false, message: 'No code is waiting. Request a new one.' });
            }
            if (record.attempts >= OTP_MAX_ATTEMPTS) {
                return res.status(429).json({ success: false, message: 'Too many incorrect attempts.' });
            }
            if (!timingSafeEqual(record.otpHash, hashOtp(value, String(code)))) {
                record.attempts += 1;
                if (record.attempts >= OTP_MAX_ATTEMPTS) record.consumedAt = new Date();
                await record.save();
                return res.status(400).json({ success: false, message: 'Incorrect code.' });
            }
            record.consumedAt = new Date();
            await record.save();
        }

        // Re-read both rows after the challenge: anything could have changed
        // while the person was reading their inbox, and the plan is what
        // decides which account's records move.
        const [meNow, otherNow] = await Promise.all([
            User.findOne({ where: { idUsers: me.idUsers } }),
            User.findOne({ where: { idUsers: other.idUsers } }),
        ]);
        if (!meNow || !otherNow) {
            return res.status(404).json({ success: false, message: 'Account not found' });
        }

        const planned = await planMerge(meNow, otherNow, survivorId);
        if (!planned.ok) {
            return res.status(409).json({ success: false, code: planned.code, message: planned.message });
        }

        const { movedRows } = await applyMerge(planned.plan);

        const survivor = await User.findOne({ where: { idUsers: planned.plan.survivorId } });
        if (!survivor) {
            return res.status(500).json({ success: false, message: 'Merge completed but the account could not be read back' });
        }

        /*
         * A fresh token, because the caller may not be the survivor.
         *
         * If their own account was the one merged away, the token they arrived
         * with names an account that can no longer sign in — they would be
         * silently logged out by their own successful merge.
         */
        return res.status(200).json({
            success: true,
            message: 'Accounts merged.',
            survivorId: planned.plan.survivorId,
            recordsMoved: movedRows,
            needsProfile: needsProfile(survivor),
            bookingBlockers: bookingBlockers(survivor),
            token: jwt.sign(
                { idUsers: Number(survivor.idUsers), userType: survivor.userType ?? 'investor' },
                JWT_SECRET,
                { expiresIn: '30d' },
            ),
        });
    }

    return res.status(400).json({ success: false, message: 'step must be check, request or confirm' });
}

export default withCors(handler);
