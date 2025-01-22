import { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import JWTPayload from '@/types/JWTPayload';
import { JWT_SECRET } from '@/config/constants';
import { User } from '@/models/__associations';
import Cors from 'micro-cors';
import _ from 'await-to-js';
import { generateNotification } from '@/notifications';

const cors = Cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS', 'PUT'],
    allowHeaders: ['X-Requested-With', 'Authorization', 'Content-Type'],
});

async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'OPTIONS') { return res.status(200).end(); }
    if (req.method === 'POST') {
        let tokenData = req.headers.authorization;
        let token = tokenData?.split(' ')[1];

        if (!token || jwt.verify(token, JWT_SECRET) === null) { res.status(401).json({ success: false, message: 'Invalid token' }); return; }

        let userInfo = jwt.decode(token) as JWTPayload;
        if (userInfo.userType !== 'admin') { res.status(403).json({ success: false, message: 'Access denied' }); return; }

        let { idUsers }: { idUsers: number } = req.body;
        let { verificationType, verificationStatus }: { verificationType: string, verificationStatus: string } = req.body;

        if (!idUsers) { return res.status(400).json({ success: false, message: 'User ID is required' }); }
        if (!verificationType) { return res.status(400).json({ success: false, message: 'Verification type is required' }); }

        if (verificationType == 'email') {
            let user = await User.findOne({ where: { idUsers } });
            if (!user) { return res.status(404).json({ success: false, message: 'User not found' }); }
            if (user.emailVerified == 'yes') { return res.status(400).json({ success: false, message: 'User email already verified' }); }

            user.emailVerified = 'yes';
            let [err, result] = await _(user.save());
            if (err) { return res.status(400).json({ success: false, message: err.message }); }

            await generateNotification("email_verified_manual", user, user);
            return res.status(200).json({ success: true, message: 'User email verified', userData: user });
        }

        if (verificationType == 'phone') {
            let user = await User.findOne({ where: { idUsers } });
            if (!user) { return res.status(404).json({ success: false, message: 'User not found' }); }
            if (user.phoneVerified == 'yes') { return res.status(400).json({ success: false, message: 'User phone already verified' }); }

            user.phoneVerified = 'yes';
            let [err, result] = await _(user.save());
            if (err) { return res.status(400).json({ success: false, message: err.message }); }

            await generateNotification("phone_verified_manual", user, user);
            return res.status(200).json({ success: true, message: 'User phone verified', userData: user });
        }

        if (verificationType == 'nid') {
            if (!verificationStatus) { return res.status(400).json({ success: false, message: 'Invalid verification status' }); }

            if (verificationStatus == 'approved') {
                let user = await User.findOne({ where: { idUsers } });
                if (!user) { return res.status(404).json({ success: false, message: 'User not found' }); }
                if (user.nidVerified == 'yes') { return res.status(400).json({ success: false, message: 'User NID already verified' }); }

                user.nidVerified = 'yes';
                user.nidVerificationStatus = 'approved';
                let [err, result] = await _(user.save());
                if (err) { return res.status(400).json({ success: false, message: err.message }); }

                await generateNotification("nid_verified", user, user);
                return res.status(200).json({ success: true, message: 'User NID verified', userData: user });
            } else if(verificationStatus == 'rejected') {
                let user = await User.findOne({ where: { idUsers } });
                if (!user) { return res.status(404).json({ success: false, message: 'User not found' }); }
                if (user.nidVerificationStatus != 'pending') { return res.status(400).json({ success: false, message: 'User NID does not require verification' }); }

                user.nidVerified = 'no';
                user.nidVerificationStatus = 'rejected';
                let [err, result] = await _(user.save());
                if (err) { return res.status(400).json({ success: false, message: err.message }); }

                await generateNotification("nid_verification_failed", user, user);
                return res.status(200).json({ success: true, message: 'User NID rejected', userData: user });
            }

        }
        else {
            res.status(405).json({ success: false, message: 'Method not allowed' });
        }
    }
}

export default cors(handler as any);