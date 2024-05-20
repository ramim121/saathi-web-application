import { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import { JWT_SECRET, OTP_EXPIRY } from '@/config/constants';
import { User, ProjectInvestor, ProjectPartner, Project } from '@/models/__associations';
import SendSms from '@/utils/sendSms';


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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'POST') {
        const { phone } = req.body;
        if (!phone) {
            return res.status(400).json({ message: 'Phone number is required' });
        }

        const bangladeshPhoneRegex = /^(\+88)?(01[3-9]\d{8})$/;
        if (!bangladeshPhoneRegex.test(phone)) {
            return res.status(400).json({ message: 'Invalid phone number' });
        }

        if (otps[phone] && otps[phone].expiry > Date.now()) {
            return res.status(400).json({ message: 'OTP already sent' });
        }

        otps[phone] = {
            otp: generateOTP(),
            expiry: Date.now() + OTP_EXPIRY
        };
        const message = `Welcome to SAATHI. Your OTP is ${otps[phone].otp}`;
        console.log(await SendSms(message, phone));

        return res.status(200).json({ message: 'OTP sent successfully' });
    } else if (req.method === 'PUT') {
        const { phone, otp } = req.body;

        if (!phone || !otp) {
            return res.status(400).json({ message: 'Phone number and OTP is required' });
        }

        if (!otps[phone] || otps[phone].otp !== otp) {
            return res.status(400).json({ message: 'Invalid OTP' });
        }

        if (otps[phone].expiry < Date.now()) {
            return res.status(400).json({ message: 'OTP expired. try again' });
        }

        delete otps[phone];

        let user = await User.findOne({
            where: {
                phoneNumber: phone
            },
            include: [
                { model: ProjectInvestor, as: 'Investments', include: [Project] },
                { model: ProjectPartner, as: 'Partnerships', include: [Project] }
            ],
        });

        if (!user) {
            user = new User();
            user.phoneNumber = phone;
            user.phoneVerified = 'yes';
            await user.save();
        }

        const token = jwt.sign({ id: user.idUsers }, JWT_SECRET, {
            expiresIn: '30d'
        });

        return res.status(200).json({ token, user });
    }
}

