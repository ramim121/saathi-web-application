import { NextApiRequest, NextApiResponse } from 'next';
import Cors from 'micro-cors';
import { OAuth2Client } from 'google-auth-library';
import { GOOGLE_CLIENT_ID, JWT_SECRET, S3_BUCKET_ACCESS_KEY, S3_BUCKET_REGION, S3_BUCKET_SECRET_KEY, S3_BUCKET_NAME } from '@/config/constants';
import { Project, ProjectInvestor, ProjectPartner, User, Bank, BankBranch, UserBank } from '@/models/__associations';
import jwt from 'jsonwebtoken';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { generateHash } from '@/utils/GenerateHash';
import axios from 'axios';
const s3Client = new S3Client({
    region: S3_BUCKET_REGION,
    credentials: {
        accessKeyId: S3_BUCKET_ACCESS_KEY,
        secretAccessKey: S3_BUCKET_SECRET_KEY
    }
});
import { generateNotification } from '@/notifications';

// Initialize the Google OAuth2 client
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

interface GoogleUser {
    email: string;
    name: string;
    picture: string;
    googleId: string;
}

const cors = Cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS', 'PUT'],
    allowHeaders: ['X-Requested-With', 'Authorization', 'Content-Type'],
});

async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'OPTIONS') { return res.status(200).end(); }
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }
    const { idToken } = req.body;

    if (!idToken) {
        return res.status(400).json({ message: 'ID token is required' });
    }

    try {
        // Verify the ID token
        const ticket = await client.verifyIdToken({
            idToken,
            audience: GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();

        if (!payload) {
            return res.status(400).json({ message: 'Invalid ID token' });
        }

        const { email, name, picture, sub: googleId } = payload;

        let user = await User.findOne({
            where: {
                email: email,
                googleLogin: 'yes'
            },
            include: [
                { model: ProjectInvestor, as: 'Investments', include: [Project] },
                { model: ProjectPartner, as: 'Partnerships', include: [Project] },
                { model: UserBank, include: [Bank, BankBranch] },
            ],
        });

        if (!user) {
            const fileName = await uploadProfilePictureToS3(picture!, googleId!);

            user = new User();
            user.email = email!;
            user.fullName = name!;
            user.profileImage = fileName;
            user.googleId = googleId!;
            user.emailVerified = 'yes';
            user.googleLogin = 'yes';
            await user.save();
            await generateNotification("signup_completion", user, user);
        }

        const token = jwt.sign({ idUsers: user.idUsers, userType: user.userType }, JWT_SECRET, {
            expiresIn: '30d'
        });


        return res.status(200).json({ success: true, token, user });

    } catch (error) {
        console.error('Error during Google Sign-In:', error);
        res.status(500).json({ message: 'Authentication failed', error: (error as Error).message });
    }
}

async function uploadProfilePictureToS3(imageUrl: string, userId: string): Promise<string> {
    try {
        const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data, 'binary');

        const fileName = generateHash(Date.now() + userId.toString() + imageUrl) + '.jpeg';
        const key = `profile/` + fileName;

        await s3Client.send(new PutObjectCommand({
            Bucket: S3_BUCKET_NAME,
            ACL: 'public-read',
            Key: key,
            Body: buffer,
            ContentType: `image/jpeg`,
        }));

        return fileName;
    } catch (error) {
        throw error;
    }
}

export default cors(handler as any);