import { NextApiRequest, NextApiResponse } from 'next';
import { S3_BUCKET_ACCESS_KEY, S3_BUCKET_SECRET_KEY, S3_BUCKET_REGION, S3_BUCKET_NAME } from '@/config/constants';
import { generateHash } from '@/utils/GenerateHash';
import * as formidable from 'formidable';
import _ from 'await-to-js';
import fs from 'fs';
import ProjectInvestmentBooking from '@/models/ProjectInvestmentBooking';
import Joi from 'joi';
import BookingStatusEntry from '@/utils/BookingStatusEntry';
import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '@/config/constants';
import JWTPayload from '@/types/JWTPayload';
import Cors from 'micro-cors';
import sequelize from '@/config/db';
import { PROOF_SUBMITTED_WRITE_VALUE } from '@/utils/bookingStatus';
const s3Client = new S3Client({
    region: S3_BUCKET_REGION,
    credentials: {
        accessKeyId: S3_BUCKET_ACCESS_KEY,
        secretAccessKey: S3_BUCKET_SECRET_KEY
    }
});

const cors = Cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS', 'PUT'],
    allowHeaders: ['X-Requested-With', 'Authorization', 'Content-Type'],
});

const schema = Joi.object({
    bookingId: Joi.string().required().messages({
        "any.required": "Booking id is required",
        "string.base": "Booking id is required",
    }),
}).unknown();

async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    let tokenData = req.headers.authorization;
    let token = tokenData?.split(' ')[1];

    if (!token || jwt.verify(token, JWT_SECRET) === null) {
        return res.status(401).json({ success: false, message: 'Invalid token' });
    }

    let userInfo = jwt.decode(token) as JWTPayload;
    if (userInfo.userType !== 'admin') {
        return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const form = new formidable.IncomingForm({ maxFileSize: 10 * 1024 * 1024 });

    form.parse(req, async (err, fields, files) => {
        if (err) {
            return res.status(400).json({ success: false, message: err.message });
        }

        const data = {
            bookingId: fields.bookingId ? fields.bookingId[0] : null,
        };

        const options = { abortEarly: false };
        const { error } = schema.validate(data, options);

        if (error) {
            const errorMessage = error.details.map(e => e.message).join('. <br>');
            return res.status(400).json({ success: false, message: errorMessage });
        }

        const transaction = await sequelize.transaction();
        try {
            const booking = await ProjectInvestmentBooking.findByPk(String(data.bookingId), { transaction });

            if (!booking) {
                await transaction.rollback();
                return res.status(404).json({ success: false, message: 'Booking not found' });
            }

            if (!files['proofOfPayment']) {
                await transaction.rollback();
                return res.status(400).json({ success: false, message: 'Proof of payment is required' });
            }

            const proofOfPaymentFile = files['proofOfPayment'][0] as formidable.File;

            if (!['image/jpeg', 'image/png'].includes(proofOfPaymentFile.mimetype!)) {
                await transaction.rollback();
                return res.status(400).json({ success: false, message: `Invalid file type: ${proofOfPaymentFile.mimetype}. Only JPEG and PNG files are allowed.` });
            }

            const proofOfPaymentFileName = generateHash(
                Date.now() + (booking?.idProjectInvestmentBookings?.toString() ?? '') + proofOfPaymentFile.originalFilename
            ) + '.' + proofOfPaymentFile.originalFilename!.split('.').pop();

            const params: any = {
                Bucket: S3_BUCKET_NAME,
                ContentType: proofOfPaymentFile.mimetype!,
                // No public ACL. These are bank receipts, deposit slips and cheque

                // images; they are read through /api/files/proof-of-payment/{bookingId},

                // which checks ownership and issues a five-minute presigned URL.
                Body: fs.createReadStream(proofOfPaymentFile.filepath),
                Key: 'proof-of-payment/' + proofOfPaymentFileName
            };

            const upload = new Upload({ client: s3Client, params });

            upload.on('httpUploadProgress', (progress: any) => {
                console.log(`Uploaded ${progress.loaded} of ${progress.total} bytes`);
            });

            await upload.done();

            booking.proofOfPayment = proofOfPaymentFileName;
            booking.paymentConfirmationStatus = PROOF_SUBMITTED_WRITE_VALUE;

            await booking.save({ transaction });

            const bookingStatus = await BookingStatusEntry('proof_of_payment_uploaded', booking.idProjectInvestmentBookings!, userInfo.idUsers, '', transaction);
            if (!bookingStatus) {
                await transaction.rollback();
                throw new Error('Error updating booking status');
            }

            await transaction.commit();

            return res.status(200).json({ success: true, message: 'Proof of payment uploaded successfully' });
        } catch (error) {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: (error as Error).message });
        }
    });
}

export const config = {
    api: {
        bodyParser: false,
    },
};

export default cors(handler as any);
