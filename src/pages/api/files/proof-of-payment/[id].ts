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
import { ProjectInvestmentBooking } from '@/models/__associations';
import { withCors } from '@/utils/auth';

/**
 * Serves a proof-of-payment image through a short-lived presigned URL.
 *
 * WHY
 * These files were uploaded with `ACL: 'public-read'`, which made every bank
 * receipt, deposit slip and cheque image readable by anyone with the URL —
 * confirmed by an anonymous request returning 200. The filename is a SHA-256
 * hash, so it is not enumerable, but an unguessable URL is not access control:
 * it leaks through referrer headers, browser history, shared screenshots and
 * anywhere the link is pasted.
 *
 * The upload no longer sets a public ACL. This route is how the image is read
 * instead: it checks that the caller owns the booking (or is an admin), then
 * redirects to a URL that expires in five minutes.
 *
 *   GET /api/files/proof-of-payment/{idProjectInvestmentBookings}
 *
 * The booking id is used rather than the filename, so possession of a filename
 * grants nothing — authorisation is decided against a record, not a string.
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

    /**
     * Bearer header *or* the `saathi-token` cookie.
     *
     * The admin panel renders this URL in an `<img src>`, and an image request
     * cannot carry an Authorization header — but it does carry same-origin
     * cookies. Both are accepted so the same route serves the panel and any
     * programmatic caller.
     *
     * Accepting a cookie on a GET is safe here: this reads a resource the
     * caller is already authorised for and changes nothing, so there is no
     * state for a cross-site request to forge.
     */
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
        return res.status(400).json({ success: false, message: 'Invalid booking id' });
    }

    const booking = await ProjectInvestmentBooking.findOne({
        where: { idProjectInvestmentBookings: id },
        attributes: ['idProjectInvestmentBookings', 'idUsers', 'proofOfPayment'],
    });

    // 404 rather than 403 throughout: a 403 confirms the booking exists, which
    // is one of the things this route exists to stop leaking.
    if (!booking || !booking.proofOfPayment) {
        return res.status(404).json({ success: false, message: 'Not found' });
    }

    if (userInfo.userType !== 'admin' && Number(booking.idUsers) !== Number(userInfo.idUsers)) {
        return res.status(404).json({ success: false, message: 'Not found' });
    }

    const url = await getSignedUrl(
        s3,
        new GetObjectCommand({
            Bucket: S3_BUCKET_NAME,
            Key: `proof-of-payment/${booking.proofOfPayment}`,
        }),
        { expiresIn: EXPIRES_IN_SECONDS },
    );

    // `no-store` matters: a cached redirect would outlive the signature and
    // hand a stale, dead URL to the next viewer.
    res.setHeader('Cache-Control', 'no-store');
    return res.redirect(302, url);
}

export default withCors(handler);
