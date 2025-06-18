// pages/api/auth/apple.ts
import { NextApiRequest, NextApiResponse } from 'next';
import Cors from 'micro-cors';
import jwt from 'jsonwebtoken';
import { verifyIdToken } from 'apple-signin-auth';              // npm i apple-signin-auth
import {
    APPLE_CLIENT_ID,
    JWT_SECRET,
    S3_BUCKET_ACCESS_KEY,
    S3_BUCKET_REGION,
    S3_BUCKET_SECRET_KEY,
    S3_BUCKET_NAME,
} from '@/config/constants';
import {
    Project,
    ProjectInvestor,
    ProjectPartner,
    User,
    Bank,
    BankBranch,
    UserBank,
} from '@/models/__associations';
import { Op } from 'sequelize';
import { generateNotification } from '@/notifications';

const cors = Cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['X-Requested-With', 'Authorization', 'Content-Type'],
});

async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const { idToken, name } = req.body;
    console.log('Apple Sign-In request body:', req.body);
    if (!idToken) {
        return res.status(400).json({ message: 'Apple ID token is required' });
    }



    try {
        // 1. Verify the Apple identity token
        const payload = await verifyIdToken(idToken, {
            audience: APPLE_CLIENT_ID,
            ignoreExpiration: false,
        }) as {
            sub: string;
            email: string;
            email_verified: 'true' | 'false';
        };

        const { sub: appleId, email, email_verified } = payload;

        console.log('Apple ID payload:', payload);

        // 2. Find existing user (matching Apple or Google or verified email)
        let user = await User.findOne({
            where: {
                email: email,
                [Op.or]: {
                    appleLogin: 'yes',
                    googleLogin: 'yes',
                    emailVerified: 'yes',
                },
            },
            include: [
                { model: ProjectInvestor, as: 'Investments', include: [Project] },
                { model: ProjectPartner, as: 'Partnerships', include: [Project] },
                { model: UserBank, include: [Bank, BankBranch] },
            ],
        });

        if(user){
            console.log('Found existing user:', user.email);
        }

        if (user && user.status === 'deleted') {
            return res.status(400).json({ message: 'Your account has been deleted' });
        }

        // 3. If no user, create one
        if (!user) {
            console.log('Creating new user with Apple ID:', appleId);
            console.log('Email:', email, 'Name:', name, 'Email Verified:', email_verified);
            
            user = new User();
            user.email = email;
            user.fullName = name;
            user.appleId = appleId;
            user.appleLogin = 'yes';
            user.emailVerified = email_verified ? 'yes' : 'no';
            await user.save();
            await generateNotification('signup_completion', user, user);
        }

        // 4. Issue your app JWT
        const token = jwt.sign(
            { idUsers: user.idUsers, userType: user.userType },
            JWT_SECRET,
            { expiresIn: '30d' }
        );

        return res.status(200).json({ success: true, token, user });
    } catch (err) {
        console.error('Apple Sign-In error:', err);
        return res
            .status(400)
            .json({ message: 'Authentication failed', error: (err as Error).message });
    }
}

export default cors(handler as any);
