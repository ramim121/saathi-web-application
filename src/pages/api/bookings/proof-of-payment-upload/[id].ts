import { NextApiRequest, NextApiResponse } from 'next';
import { S3_BUCKET_ACCESS_KEY, S3_BUCKET_SECRET_KEY, S3_BUCKET_REGION, S3_BUCKET_NAME } from '@/config/constants';
import { generateHash } from '@/utils/GenerateHash';
import * as formidable from 'formidable';
import _ from 'await-to-js';
import fs from 'fs';
import ProjectInvestmentBooking from '@/models/ProjectInvestmentBooking';
import Joi from 'joi';

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

const schema = Joi.object({
    paymentMethod: Joi.string().required().messages({
        "any.required": "Payment method is required",
        "string.base": "Payment method is required",
    }),
    collectionDate: Joi.alternatives().conditional('paymentMethod', {
        is: 'cheque',
        then: Joi.string()
            .pattern(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
            .required()
            .messages({
                "any.required": "Collection date is required when payment method is cheque",
                "string.pattern.base": "Collection date must be in the format YYYY-MM-DD HH:mm:ss",
            }),
        otherwise: Joi.string().optional().allow(null, ''),
    }),
    collectionLocation: Joi.alternatives().conditional('paymentMethod', {
        is: 'cheque',
        then: Joi.string().required().messages({
            "any.required": "Collection location is required when payment method is cheque",
            "string.base": "Collection location is required",
        }),
        otherwise: Joi.string().optional().allow(null, '')
    })
}).unknown();

async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'OPTIONS') { return res.status(200).end(); }
    const booking = await ProjectInvestmentBooking.findByPk(String(req.query.id));

    if (!booking) {
        return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const form = new formidable.IncomingForm({ maxFileSize: 2 * 1024 * 1024 });

    form.parse(req, async (err, fields, files) => {
        if (err) { return res.status(500).json({ success: false, message: err.message }); }

        const data = {
            paymentMethod: fields.paymentMethod ? fields.paymentMethod[0] : null,
            collectionDate: fields.collectionDate ? fields.collectionDate[0] : null,
            collectionLocation: fields.collectionLocation ? fields.collectionLocation[0] : null
        }

        console.log('data', data.paymentMethod);

        const options = {
            abortEarly: false,
        };
        const { error } = schema.validate(data, options);

        if (error) {
            let errorMessage: string[] = [];

            error.details.forEach((e) => {
                errorMessage.push(e.message);
            });
            return res.status(400).json({ success: false, message: errorMessage.join(". <br>") });
        }

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

        if (data.paymentMethod) {
            booking.paymentMethod = data.paymentMethod as 'cheque' | 'beftn' | 'rtgs' | 'npsb' | 'cash';
        }
        booking.proofOfPayment = proofOfPaymentFileName;
        booking.paymentConfirmationStatus = 'uploaded';
        booking.collectionRequired = data.paymentMethod === 'cheque' ? 'yes' : 'no';
        booking.collectionStatus = data.paymentMethod === 'cheque' ? 'pending' : null;
        booking.collectionDate = data.paymentMethod === 'cheque' ? data.collectionDate : null;
        booking.collectionLocation = data.paymentMethod === 'cheque' ? data.collectionLocation : null;

        let [err2] = await _(booking.save());
        if (err2) { return res.status(500).json({ success: false, message: err2.message }); }

        return res.status(200).json({ success: true, message: 'Proof of payment uploaded successfully' });

    });
}

export const config = {
    api: {
        bodyParser: false,
    },
};

export default cors(handler as any);