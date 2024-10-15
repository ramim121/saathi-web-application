import { NextApiRequest, NextApiResponse } from 'next';
import { S3_BUCKET_ACCESS_KEY, S3_BUCKET_SECRET_KEY, S3_BUCKET_REGION, S3_BUCKET_NAME } from '@/config/constants';
import { generateHash } from '@/utils/GenerateHash';
import * as formidable from 'formidable';
import _ from 'await-to-js';
import fs from 'fs';
import ProjectInvestmentBooking from '@/models/ProjectInvestmentBooking';

import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';

const s3Client = new S3Client({
    region: S3_BUCKET_REGION,
    credentials: {
        accessKeyId: S3_BUCKET_ACCESS_KEY,
        secretAccessKey: S3_BUCKET_SECRET_KEY
    }
});
import Cors from 'micro-cors';
const cors = Cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS', 'PUT'],
    allowHeaders: ['X-Requested-With', 'Authorization', 'Content-Type'],
});

async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'OPTIONS') { return res.status(200).end(); }
    const booking = await ProjectInvestmentBooking.findByPk(String(req.query.id));

    if (!booking) {
        return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const form = new formidable.IncomingForm({ maxFileSize: 2 * 1024 * 1024 });

    form.parse(req, async (error, fields, files) => {
        if (error) { return res.status(500).json({ success: false, message: error.message }); }

        if (!files['proofOfPayment']) { return res.status(400).json({ success: false, message: 'Proof of payment is required' }); }

        const proofOfPaymentFile = files['proofOfPayment']![0] as formidable.File;

        if (proofOfPaymentFile.mimetype !== 'image/jpeg' && proofOfPaymentFile.mimetype !== 'image/png') {
            return res.status(400).json({ success: false, message: `Invalid file type: ${proofOfPaymentFile.mimetype}. Only JPEG and PNG files are allowed.` });
        }

        if (!proofOfPaymentFile) { return res.status(400).json({ success: false, message: 'Proof of payment is required' }); }

        let proofOfPaymentFileName = generateHash(Date.now() + (booking?.idProjectInvestmentBookings?.toString() ?? '') + proofOfPaymentFile.originalFilename!.toString()) + '.' + proofOfPaymentFile.originalFilename!.split('.').pop();

        const params: any = {
            Bucket: S3_BUCKET_NAME,
            ContentType: proofOfPaymentFile.mimetype!,
            ACL: 'public-read',
            Body: fs.createReadStream(proofOfPaymentFile.filepath),
            Key: 'proof-of-payment/' + proofOfPaymentFileName
        };

        const upload = new Upload({
            client: s3Client,
            params: params
        });

        upload.on('httpUploadProgress', (progress: any) => {
            console.log(`Uploaded ${progress.loaded} of ${progress.total} bytes`);
        });
        let [err1, result1] = await _(upload.done());
        if (err1) { return res.status(500).json({ success: false, message: err1.message }); }

        booking.proofOfPayment = proofOfPaymentFileName;
        booking.paymentConfirmationStatus = 'uploaded';

        let [err] = await _(booking.save());
        if (err) { return res.status(500).json({ success: false, message: err.message }); }

        return res.status(200).json({ success: true, message: 'Proof of payment uploaded successfully' });

    });
}

export const config = {
    api: {
        bodyParser: false,
    },
};

export default cors(handler as any);