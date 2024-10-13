import { NextApiRequest, NextApiResponse } from 'next';
import { S3_BUCKET_ACCESS_KEY, S3_BUCKET_SECRET_KEY, S3_BUCKET_REGION, S3_BUCKET_NAME } from '@/config/constants';
import { generateHash } from '@/utils/GenerateHash';
import * as formidable from 'formidable';
import _ from 'await-to-js';
import AWS from 'aws-sdk';
import fs from 'fs';
import ProjectInvestmentBooking from '@/models/ProjectInvestmentBooking';

// Configure AWS SDK with your credentials and region
AWS.config.update({
    accessKeyId: S3_BUCKET_ACCESS_KEY,
    secretAccessKey: S3_BUCKET_SECRET_KEY,
    region: S3_BUCKET_REGION,
});

// Create an S3 instance
const s3 = new AWS.S3();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {

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

        const params = {
            Bucket: S3_BUCKET_NAME,
            ACL: 'public-read'
        };

        let [err1, result1] = await _(s3.upload({ ...params, ContentType: proofOfPaymentFile.mimetype!, Body: fs.createReadStream(proofOfPaymentFile.filepath), Key: 'proof-of-payment/' + proofOfPaymentFileName }).promise());
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