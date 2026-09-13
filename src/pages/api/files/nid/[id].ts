import { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
    JWT_SECRET,
    S3_BUCKET_NAME,
    S3_BUCKET_REGION,
    S3_BUCKET_ACCESS_KEY,
    S3_BUCKET_SECRET_KEY,
} from '@/config/constants';
import JWTPayload from '@/types/JWTPayload';
import { User } from '@/models/__associations';
import { withCors } from '@/utils/auth';

/**
 * Serves a NID scan through a short-lived presigned URL.
 *
 *   GET /api/files/nid/{idUsers}?side=front|back
 *
 * WHY
 * NID images are uploaded with `ACL: 'public-read'`, which makes every national
 * ID card readable by anyone holding the URL — confirmed by an anonymous
 * request returning 200 against a real object. There are 97 of them on the
 * staging database alone. The filename is a SHA-256 hash, which is not a
 * mitigation: URLs leak through referrer headers, browser history, screenshots
 * and support tickets.
 *
 * This is the read path that replaces the public URL. It takes the **user id**,
 * not a filename, so holding a filename grants nothing — authorisation is
 * decided against a record.
 *
 * THE UPLOAD STILL SETS A PUBLIC ACL, DELIBERATELY.
 * The shipped mobile app renders NID images straight from the bucket URL
 * (`NidInfo.tsx`, `ProfileInfo.tsx`). Making the prefix private today would
 * leave every installed copy showing a broken image where the user reviews
 * their own ID. So the order is: ship this route, point the admin panel and a
 * new app release at it, and only then drop the ACL and retrofit the existing
 * objects. See docs/s3-object-privacy.md.
 */

const EXPIRES_IN_SECONDS = 300;

const s3 = new S3Client({
    region: S3_BUCKET_REGION,
    credentials: {
        accessKeyId: S3_BUCKET_ACCESS_KEY,
        secretAccessKey: S3_BUCKET_SECRET_KEY,
    },
});

async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

    // Bearer header or the `saathi-token` cookie: an `<img src>` cannot send a
    // header, and the admin panel renders these in one.
    const token = req.headers.authorization?.split(' ')[1] ?? req.cookies?.['saathi-token'];
    if (!token) {
        return res.status(401).json({ success: false, message: 'Token not found' });
    }

    let userInfo: JWTPayload;
    try {
        jwt.verify(token, JWT_SECRET);
        userInfo = jwt.decode(token) as JWTPayload;
    } catch {
        return res.status(401).json({ success: false, message: 'Invalid token' });
    }

    const id = Number(req.query.id);
    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid user id' });
    }

    const side = req.query.side === 'back' ? 'back' : 'front';

    /**
     * An ID card is readable by its owner and by an admin, and by nobody else.
     * 404 rather than 403 throughout, so this cannot be used to discover which
     * accounts have submitted a NID.
     */
    if (userInfo.userType !== 'admin' && Number(userInfo.idUsers) !== id) {
        return res.status(404).json({ success: false, message: 'Not found' });
    }

    const user = await User.findOne({
        where: { idUsers: id },
        attributes: ['idUsers', 'nidImageFront', 'nidImageBack'],
    });

    const fileName = side === 'back' ? user?.nidImageBack : user?.nidImageFront;
    if (!user || !fileName) {
        return res.status(404).json({ success: false, message: 'Not found' });
    }

    const url = await getSignedUrl(
        s3,
        new GetObjectCommand({ Bucket: S3_BUCKET_NAME, Key: `nid/${fileName}` }),
        { expiresIn: EXPIRES_IN_SECONDS },
    );

    // A cached redirect would outlive the signature and hand the next viewer a
    // dead URL.
    res.setHeader('Cache-Control', 'no-store');
    return res.redirect(302, url);
}

export default withCors(handler);
