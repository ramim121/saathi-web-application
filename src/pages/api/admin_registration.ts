import { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcrypt';
import { User } from '@/models/__associations';
import Joi from 'joi';
import sequelize from '@/config/db';
import { requireAdmin, withCors } from '@/utils/auth';
import { ADMIN_PASSWORD_MAX, ADMIN_PASSWORD_MIN } from '@/utils/adminPassword';

// Admin sign-in (api/login) is email + password, so a new admin needs both.

const schema = Joi.object({
    name: Joi.string().required().messages({
        "any.required": "Name is required",
        "string.empty": "Name can not be empty",
    }),
    email: Joi.string().email().required().messages({
        "any.required": "Email is required",
        "string.empty": "Email can not be empty",
        "string.email": "Invalid email",
    }),
    phoneNumber: Joi.string().pattern(/^01\d{9}$/).required().messages({
        "any.required": "Phone number is required",
        "string.empty": "Phone number can not be empty",
        "string.pattern.base": "Phone number must be 11 digits and start with 01",
    }),
    password: Joi.string().min(ADMIN_PASSWORD_MIN).max(ADMIN_PASSWORD_MAX).required().messages({
        "any.required": "Password is required",
        "string.empty": "Password can not be empty",
        "string.min": `Password must be at least ${ADMIN_PASSWORD_MIN} characters`,
        "string.max": `Password can be at most ${ADMIN_PASSWORD_MAX} characters`,
    }),
}).unknown();

async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        res.status(405).json({ success: false, message: 'Method not allowed' });
        return;
    }

    const { name, email, phoneNumber, password } = req.body;
    const { error } = schema.validate({ name, email, phoneNumber, password }, { abortEarly: false });
    if (error) {
        return res.status(400).json({ success: false, message: error.details.map((e) => e.message).join(". <br>") });
    }

    // Sign-in finds the admin by email, so two admins must not share one.
    const existing = await User.findOne({ where: { email, userType: 'admin' }, attributes: ['idUsers'] });
    if (existing) {
        return res.status(400).json({ success: false, message: 'An admin with this email already exists' });
    }

    const transaction = await sequelize.transaction();
    try {
        const admin = await User.create({
            fullName: name,
            email,
            phoneNumber,
            userType: 'admin',
            password: await bcrypt.hash(password, 10),
        }, { transaction });
        await transaction.commit();
        // Never echo the created row: it now carries the password hash.
        return res.status(200).json({
            success: true,
            message: 'Admin registered successfully',
            data: { idUsers: admin.idUsers, fullName: admin.fullName, email: admin.email },
        });
    } catch (err) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: (err as Error).message });
    }
}

export default withCors(requireAdmin(handler));
