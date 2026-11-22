import { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import JWTPayload from '@/types/JWTPayload';
import { JWT_SECRET } from '@/config/constants';
import { User, Project, ProjectInvestor, ProjectPartner, UserBank, Bank, BankBranch } from '@/models/__associations';
import Joi from 'joi';
import Cors from 'micro-cors';
import Sequelize from 'sequelize';
import { Op } from 'sequelize';
const cors = Cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS', 'PUT'],
    allowHeaders: ['X-Requested-With', 'Authorization', 'Content-Type'],
});

/**
 * PUT /api/user — the app's profile save.
 *
 * Every field is optional: a field that is missing, `null` or (for email)
 * empty is left as it is. Callers send what they changed.
 *
 * WHY
 * - Accounts created with a phone number have `email: null`, and the app's
 *   profile screen sends that null back. `Joi.string()` rejected it ("email
 *   must be a string"), so those investors could not save their name or date
 *   of birth at all.
 * - Name and date of birth were both required on every call, so a screen that
 *   only asks for a name (or the gender the website asks for) could not save.
 * - An email change kept the account's `emailVerified` as it was. Google and
 *   Apple sign-in attach to any account whose email is marked verified, so
 *   typing someone else's address into a verified account would hand that
 *   person's future social sign-in to it. A changed email is now unverified
 *   until the owner confirms it through the email verification flow.
 */
const schema = Joi.object({
    fullName: Joi.string().trim().min(1).max(100).allow(null).messages({
        "string.empty": "Name can not be empty",
        "string.min": "Name can not be empty",
        "string.max": "Name can be at most 100 characters",
    }),
    email: Joi.string().trim().email().max(255).allow(null, '').messages({
        "string.email": "Invalid email",
    }),
    // No upper bound: the shipped app sends the current instant when its date
    // picker is left untouched, and a phone clock a few seconds ahead of the
    // server would then fail every save.
    dateOfBirth: Joi.date().allow(null).messages({
        "date.base": "Date of birth must be a date",
    }),
    gender: Joi.string().valid('male', 'female', 'other', 'prefer_not_to_say').allow(null).messages({
        "any.only": "Gender must be male, female, other or prefer_not_to_say",
    }),
}).unknown();

async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'OPTIONS') { return res.status(200).end(); }

    let tokenData = req.headers.authorization;
    let token = tokenData?.split(' ')[1];

    if (!token) { res.status(401).json({ success: false, message: 'Token not found' }); return; }
    try { jwt.verify(token, JWT_SECRET) } catch (e: any) { res.status(401).json({ success: false, message: e.message }); return; }

    let userInfo = jwt.decode(token) as JWTPayload;
    const user = await User.findByPk(userInfo!.idUsers,
        {
            include: [
                { model: ProjectInvestor, as: 'Investments', include: [Project] },
                { model: ProjectPartner, as: 'Partnerships', include: [Project] },
                { model: UserBank, include: [Bank, BankBranch] },
            ],
        })

    if (!user) { res.status(404).json({ message: 'User not found' }); return; }
    if (req.method == 'GET') { res.status(200).json({ user }); return; }
    if (req.method == 'PUT') {
        const { error, value } = schema.validate(req.body, { abortEarly: false });
        if (error) {
            let errorMessage: string[] = [];
            error.details.forEach((e) => {
                errorMessage.push(e.message);
            });
            return res.status(400).json({ success: false, message: errorMessage });
        }

        const changes: Record<string, unknown> = {};
        if (value.fullName !== undefined && value.fullName !== null) changes.fullName = value.fullName;
        if (value.dateOfBirth !== undefined && value.dateOfBirth !== null) changes.dateOfBirth = value.dateOfBirth;
        if (value.gender !== undefined && value.gender !== null) changes.gender = value.gender;

        const newEmail = typeof value.email === 'string' && value.email.trim() !== '' ? value.email.trim() : null;
        const currentEmail = (user.email ?? '').trim();
        if (newEmail && newEmail.toLowerCase() !== currentEmail.toLowerCase()) {
            const existingEmail = await User.findOne({
                where: {
                    [Op.and]: [
                        Sequelize.where(Sequelize.fn('LOWER', Sequelize.col('email')), newEmail.toLowerCase()),
                        { idUsers: { [Op.not]: userInfo!.idUsers } },
                    ]
                }
            });
            if (existingEmail) {
                return res.status(400).json({ success: false, message: 'Email already exists' });
            }
            changes.email = newEmail;
            changes.emailVerified = 'no';
        }

        if (Object.keys(changes).length === 0) {
            return res.status(200).json({ success: true, updatedUser: [0], message: 'Nothing to update' });
        }

        let updatedUser = await User.update(changes, { where: { idUsers: userInfo!.idUsers } });
        res.status(200).json({ success: true, updatedUser, emailVerificationRequired: changes.emailVerified === 'no' });
    }
}

export default cors(handler as any);
