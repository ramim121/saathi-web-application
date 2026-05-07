import { NextApiRequest, NextApiResponse } from 'next';
import { S3_BUCKET_ACCESS_KEY, S3_BUCKET_SECRET_KEY, S3_BUCKET_REGION, S3_BUCKET_NAME } from '@/config/constants';
import { generateHash } from '@/utils/GenerateHash';
import * as formidable from 'formidable';
import fs from 'fs';
import ProjectInvestmentBooking from '@/models/ProjectInvestmentBooking';
import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '@/config/constants';
import JWTPayload from '@/types/JWTPayload';

const s3Client = new S3Client({
    region: S3_BUCKET_REGION,
    credentials: {
        accessKeyId: S3_BUCKET_ACCESS_KEY,
        secretAccessKey: S3_BUCKET_SECRET_KEY,
    },
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'Invalid token' });
    try { jwt.verify(token, JWT_SECRET); } catch { return res.status(401).json({ success: false, message: 'Invalid token' }); }
    const userInfo = jwt.decode(token) as JWTPayload;
    if (userInfo.userType !== 'admin') {
        return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const form = new formidable.IncomingForm({ maxFileSize: 10 * 1024 * 1024 });

    form.parse(req, async (err, fields, files) => {
        if (err) {
            return res.status(400).json({ success: false, message: err.message });
        }

        const bookingId = fields.bookingId ? fields.bookingId[0] : null;
        if (!bookingId) {
            return res.status(400).json({ success: false, message: 'bookingId is required' });
        }

        const booking = await ProjectInvestmentBooking.findByPk(Number(bookingId));
        if (!booking) {
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }

        if (!files['topupProof']) {
            return res.status(400).json({ success: false, message: 'topupProof file is required' });
        }

        const file = files['topupProof'][0] as formidable.File;

        if (!['image/jpeg', 'image/png'].includes(file.mimetype!)) {
            return res.status(400).json({ success: false, message: `Invalid file type: ${file.mimetype}. Only JPEG and PNG allowed.` });
        }

        try {
            const fileName = generateHash(
                Date.now() + (booking.idProjectInvestmentBookings?.toString() ?? '') + file.originalFilename
            ) + '.' + file.originalFilename!.split('.').pop();

            const params: any = {
                Bucket: S3_BUCKET_NAME,
                ContentType: file.mimetype!,
                ACL: 'public-read',
                Body: fs.createReadStream(file.filepath),
                Key: 'proof-of-payment/' + fileName,
            };

            const upload = new Upload({ client: s3Client, params });
            await upload.done();

            booking.proofOfPayment = fileName;
            await booking.save();

            return res.status(200).json({ success: true, message: 'Top-up proof uploaded successfully' });
        } catch (error) {
            return res.status(400).json({ success: false, message: (error as Error).message });
        }
    });
}

export const config = {
    api: {
        bodyParser: false,
    },
};
