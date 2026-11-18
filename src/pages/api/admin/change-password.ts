import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcrypt';
import Joi from 'joi';
import { User } from '@/models/__associations';
import { requireAdmin, withCors, type AuthContext } from '@/utils/auth';
import { ADMIN_PASSWORD_MAX, ADMIN_PASSWORD_MIN } from '@/utils/adminPassword';

const schema = Joi.object({
    currentPassword: Joi.string().required().messages({
        'any.required': 'Enter your current password',
        'string.empty': 'Enter your current password',
    }),
    newPassword: Joi.string().min(ADMIN_PASSWORD_MIN).max(ADMIN_PASSWORD_MAX).invalid(Joi.ref('currentPassword')).required().messages({
        'any.required': 'Enter a new password',
        'string.empty': 'Enter a new password',
        'string.min': `The new password must be at least ${ADMIN_PASSWORD_MIN} characters`,
        'string.max': `The new password can be at most ${ADMIN_PASSWORD_MAX} characters`,
        'any.invalid': 'The new password must be different from the current one',
    }),
});

/**
 * A signed-in admin changes their own password. The current password is
 * required, so a borrowed session alone cannot lock the owner out.
 *
 * Sign-in tokens are stateless (30 days), so sessions already open elsewhere
 * stay signed in until they expire or sign out.
 */
async function handler(req: NextApiRequest, res: NextApiResponse, auth: AuthContext) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

    const { error, value } = schema.validate(
        { currentPassword: req.body?.currentPassword, newPassword: req.body?.newPassword },
        { abortEarly: false },
    );
    if (error) {
        return res.status(400).json({ success: false, message: error.details.map((d) => d.message).join('. <br>') });
    }

    const user = await User.scope('withPassword').findOne({ where: { idUsers: auth.idUsers, userType: 'admin' } });
    if (!user) {
        return res.status(404).json({ success: false, message: 'Account not found' });
    }

    const hash = user.get('password') as string | null;
    if (!hash || !(await bcrypt.compare(value.currentPassword, hash))) {
        return res.status(400).json({ success: false, message: 'Your current password is not right' });
    }

    user.set('password', await bcrypt.hash(value.newPassword, 10));
    await user.save();
    return res.status(200).json({ success: true, message: 'Password changed' });
}

export default withCors(requireAdmin(handler));
