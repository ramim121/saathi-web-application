import { NextApiRequest, NextApiResponse } from 'next';
import { OTP_EXPIRY } from '@/config/constants';
import { User } from '@/models/__associations';
import SendSms from '@/utils/SendSms';
import Cors from 'micro-cors';
import JWTPayload from '@/types/JWTPayload';
import _ from 'await-to-js';
import { Op } from 'sequelize';
import { generateNotificationBody } from '@/notifications';
import path from 'path';
import sendEmail from '@/utils/SendEmail';
import fs from 'fs';

const cors = Cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS', 'PUT'],
    allowHeaders: ['X-Requested-With', 'Authorization', 'Content-Type'],
});

interface OTP {
    [key: string]: {
        otp: string;
        expiry: number;
    };
}

const otps: OTP = {};

const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
    console.log(otps);
    if (req.method === 'OPTIONS') { return res.status(200).end(); }
    if (req.method === 'POST') {
        const userIdentifier = req.body.userIdentifier;
        if (!userIdentifier) {
            return res.status(400).json({ success: false, message: 'Phone number is required' });
        }
        if (checkValidEmail(userIdentifier)) {
            const email = userIdentifier;
            const userData = await User.findOne({ where: { email, status: { [Op.or]: ['active', 'inactive'] } } });
            if (!userData) {
                return res.status(400).json({ success: false, message: 'User not found' });
            }

            if (otps[email] && otps[email].expiry > Date.now()) {
                return res.status(400).json({ success: false, message: 'OTP already sent' });
            }

            otps[email] = {
                otp: generateOTP(),
                expiry: Date.now() + (OTP_EXPIRY as number)
            };

            const emailTemplateMain = fs.readFileSync(path.join(process.cwd(), 'src', 'notifications', 'email_templates', 'account_delete_otp.html'), 'utf8');
            const emailBody = generateNotificationBody(emailTemplateMain, { fullName: userData.fullName, otp: otps[email].otp });

            let emailResponse = await sendEmail({ from: "Shathi System<system@notification.n.digigramventures.com>", to: [email], subject: 'Account Deletion OTP | Shathi', htmlBody: emailBody });
            console.log('Email Response:', emailResponse);

            return res.status(200).json({ success: true, message: 'OTP sent successfully' });

        } else {
            const phone = userIdentifier;
            const bangladeshPhoneRegex = /^(\+88)?(01[3-9]\d{8})$/;
            if (!bangladeshPhoneRegex.test(phone)) {
                return res.status(400).json({ success: false, message: 'Invalid phone number' });
            }

            if (otps[phone] && otps[phone].expiry > Date.now()) {
                return res.status(400).json({ success: false, message: 'OTP already sent' });
            }

            const userData = await User.findOne({ where: { phoneNumber: phone, status: { [Op.or]: ['active', 'inactive'] } } });
            if (!userData) {
                return res.status(400).json({ success: false, message: 'User not found' });
            }

            otps[phone] = {
                otp: generateOTP(),
                expiry: Date.now() + (OTP_EXPIRY as number)
            };
            const message = `We have received an account removal request. To confirm enter the following OTP: ${otps[phone].otp} . - Shathi`;
            await SendSms(message, phone);

            return res.status(200).json({ success: true, message: 'OTP sent successfully' });
        }
    } else if (req.method === 'PUT') {
        const otp = req.body.otp;
        if (!otp) {
            return res.status(400).json({ success: false, message: 'OTP is required' });
        }

        const userIdentifier = req.body.userIdentifier;

        if (!otps[userIdentifier] || otps[userIdentifier].otp !== otp) {
            return res.status(400).json({ success: false, message: 'Invalid OTP' });
        }

        if (otps[userIdentifier].expiry < Date.now()) {
            return res.status(400).json({ success: false, message: 'OTP expired' });
        }

        const userData = await User.findOne({
            where: {
                [Op.or]: {
                    email: userIdentifier,
                    phoneNumber: userIdentifier
                },
                status: { [Op.or]: ['active', 'inactive'] }
            }
        });

        if (!userData) {
            return res.status(400).json({ success: false, message: 'User not found' });
        }

        userData.status = 'deleted';
        await userData.save();

        delete otps[userIdentifier];

        return res.status(200).json({ success: true, message: 'Account deleted successfully' });
    }
}

const checkValidEmail = (email: string) => {
    const emailRegex = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;
    return emailRegex.test(email);
}

export default cors(handler as any);