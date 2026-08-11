import { NextApiRequest, NextApiResponse } from 'next';
import { User } from '@/models/__associations';
import { withCors, readAuth } from '@/utils/auth';
import { needsProfile, bookingBlockers, profileGaps } from '@/utils/profileCompletion';

/**
 * The details a new account fills in, in two tiers.
 *
 *   GET  /api/v2/web/profile              → what is still missing
 *   POST /api/v2/web/profile { ... }      → save
 *
 * WHY THIS IS NOT THE APP'S `PUT /api/user`
 * That endpoint writes `email` straight onto the account with no verification,
 * and the shipped app depends on that. Changing it would change behaviour for
 * every installed app on deploy. This route refuses to touch `email` at all —
 * an address only ever lands on an account through
 * `v2/web/email/verify`, which requires proof of the mailbox.
 *
 * NAME AND GENDER ARE THE ONLY REQUIRED FIELDS
 * Everything else is skippable and can be filled in whenever. The rule comes
 * from what actually breaks: 121 of 425 existing accounts have no name, so they
 * appear as blank rows in the admin panel and used to receive email opening
 * "Dear ,". Nothing breaks for a missing date of birth.
 *
 * REQUIRED MEANS REQUIRED WHEN SUPPLIED, NOT MANDATORY TO CALL
 * A partial save is accepted — someone can set their name, close the tab, and
 * set their gender later. `needsProfile` in the response says whether anything
 * is still outstanding. Rejecting a partial save would lose the half they typed.
 */

const GENDERS = ['male', 'female', 'other', 'prefer_not_to_say'] as const;
type Gender = (typeof GENDERS)[number];

/** Free-text fields this route may write. `email` and every verification flag are absent by design. */
const OPTIONAL_TEXT = [
    'fullNameBn',
    'dateOfBirth',
    'location',
    'locationBn',
    'bio',
    'bioBn',
    'education',
    'educationBn',
    'interestedIn',
    'interestedInBn',
] as const;

const PUBLIC_ATTRIBUTES = [
    'idUsers',
    'fullName',
    'fullNameBn',
    'gender',
    'email',
    'phoneNumber',
    'userType',
    'profileImage',
    'dateOfBirth',
    'location',
    'bio',
    'emailVerified',
    'phoneVerified',
    'nidVerified',
    'nidVerificationStatus',
    'status',
] as const;

function publicUser(user: InstanceType<typeof User>) {
    const source = user as unknown as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of PUBLIC_ATTRIBUTES) out[key] = source[key] ?? null;
    return out;
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
    const auth = readAuth(req);
    if (!auth) {
        return res.status(401).json({ success: false, message: 'Sign in first' });
    }

    const user = await User.findOne({
        where: { idUsers: auth.idUsers, status: ['active', 'inactive'] },
    });
    if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (req.method === 'GET') {
        return res.status(200).json({
            success: true,
            needsProfile: needsProfile(user),
            missing: profileGaps(user),
            bookingBlockers: bookingBlockers(user),
            user: publicUser(user),
        });
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

    const body = (req.body ?? {}) as Record<string, unknown>;

    /* ------------------------------------------------------------- name -- */
    if (body.fullName !== undefined) {
        const fullName = String(body.fullName ?? '').trim();
        if (fullName.length < 2 || fullName.length > 120) {
            return res.status(400).json({
                success: false,
                field: 'fullName',
                message: 'Enter your full name.',
            });
        }
        user.fullName = fullName;
    }

    /* ----------------------------------------------------------- gender -- */
    if (body.gender !== undefined) {
        const gender = String(body.gender ?? '') as Gender;
        if (!GENDERS.includes(gender)) {
            return res.status(400).json({
                success: false,
                field: 'gender',
                message: 'Choose one of the listed options.',
            });
        }
        user.gender = gender;
    }

    /* --------------------------------------------------------- the rest -- */
    for (const field of OPTIONAL_TEXT) {
        if (body[field] === undefined) continue;
        const value = body[field] === null ? null : String(body[field]).trim();
        // An empty string clears the field rather than storing "".
        (user as unknown as Record<string, unknown>)[field] = value === '' ? null : value;
    }

    await user.save();

    return res.status(200).json({
        success: true,
        needsProfile: needsProfile(user),
        missing: profileGaps(user),
        bookingBlockers: bookingBlockers(user),
        user: publicUser(user),
    });
}

export default withCors(handler);
