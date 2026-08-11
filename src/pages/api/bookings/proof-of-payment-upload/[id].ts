import { NextApiRequest, NextApiResponse } from 'next';
import { S3_BUCKET_ACCESS_KEY, S3_BUCKET_SECRET_KEY, S3_BUCKET_REGION, S3_BUCKET_NAME } from '@/config/constants';
import { generateHash } from '@/utils/GenerateHash';
import * as formidable from 'formidable';
import _ from 'await-to-js';
import fs from 'fs';
import ProjectInvestmentBooking from '@/models/ProjectInvestmentBooking';
import sequelize from '@/config/db';
import Joi from 'joi';
import BookingStatusEntry from '@/utils/BookingStatusEntry';
import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '@/config/constants';
import JWTPayload from '@/types/JWTPayload';
const s3Client = new S3Client({
    region: S3_BUCKET_REGION,
    credentials: {
        accessKeyId: S3_BUCKET_ACCESS_KEY,
        secretAccessKey: S3_BUCKET_SECRET_KEY
    }
});
import Cors from 'micro-cors';
import { PROOF_SUBMITTED_WRITE_VALUE } from '@/utils/bookingStatus';
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
        is: Joi.valid('cheque', 'cash'),
        then: Joi.string()
            .pattern(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
            .required()
            .messages({
                "any.required": "Collection date is required when payment method is cheque or cash",
                "string.pattern.base": "Collection date must be in the format YYYY-MM-DD HH:mm:ss",
            }),
        otherwise: Joi.string().optional().allow(null, ''),
    }),
    collectionLocation: Joi.alternatives().conditional('paymentMethod', {
        is: Joi.valid('cheque', 'cash'),
        then: Joi.string().required().messages({
            "any.required": "Collection location is required when payment method is cheque or cash",
            "string.base": "Collection location is required",
        }),
        otherwise: Joi.string().optional().allow(null, '')
    }),
    idUserBanks: Joi.alternatives().conditional('paymentMethod', {
        is: Joi.valid('npsb', 'rtgs', 'beftn'),
        then: Joi.string().required().messages({
            "any.required": "User bank ID is required when payment method is npsb, rtgs, or beftn",
            "string.base": "User bank ID is required",
        }),
        otherwise: Joi.string().optional().allow(null, '')
    })
}).unknown();

async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'OPTIONS') { return res.status(200).end(); }

    let tokenData = req.headers.authorization;
    let token = tokenData?.split(' ')[1];

    if (!token || jwt.verify(token, JWT_SECRET) === null) {
        return res.status(401).json({ success: false, message: 'Invalid token' });
    }

    let userInfo = jwt.decode(token) as JWTPayload;

    const transaction = await sequelize.transaction();

    try {
        const booking = await ProjectInvestmentBooking.findByPk(String(req.query.id), { transaction });

        if (!booking) {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }

        // SECURITY: the token was verified above, but the booking id comes from the
        // URL and was never checked against it — so any signed-in user could attach a
        // proof-of-payment file, a payment method and a bank account to somebody
        // else's booking. Admins keep the override because the admin panel records
        // offline payments on behalf of investors.
        if (userInfo.userType !== 'admin' && booking.idUsers !== userInfo.idUsers) {
            await transaction.rollback();
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const form = new formidable.IncomingForm({ maxFileSize: 10 * 1024 * 1024 });

        form.parse(req, async (err, fields, files) => {
            if (err) {
                await transaction.rollback();
                return res.status(400).json({ success: false, message: err.message });
            }

            const data = {
                paymentMethod: fields.paymentMethod ? fields.paymentMethod[0] : null,
                collectionDate: fields.collectionDate ? fields.collectionDate[0] : null,
                collectionLocation: fields.collectionLocation ? fields.collectionLocation[0] : null,
                idUserBanks: fields.idUserBanks ? fields.idUserBanks[0] : null
            };

            const options = { abortEarly: false };
            const { error } = schema.validate(data, options);

            if (error) {
                let errorMessage: string[] = error.details.map(e => e.message);
                await transaction.rollback();
                return res.status(400).json({ success: false, message: errorMessage.join(". <br>") });
            }

            if (!files['proofOfPayment']) {
                await transaction.rollback();
                return res.status(400).json({ success: false, message: 'Proof of payment is required' });
            }

            const proofOfPaymentFile = files['proofOfPayment']![0] as formidable.File;

            if (proofOfPaymentFile.mimetype !== 'image/jpeg' && proofOfPaymentFile.mimetype !== 'image/png') {
                await transaction.rollback();
                return res.status(400).json({ success: false, message: `Invalid file type: ${proofOfPaymentFile.mimetype}. Only JPEG and PNG files are allowed.` });
            }

            let proofOfPaymentFileName = generateHash(Date.now() + (booking?.idProjectInvestmentBookings?.toString() ?? '') + proofOfPaymentFile.originalFilename!.toString()) + '.' + proofOfPaymentFile.originalFilename!.split('.').pop();

            const params: any = {
                Bucket: S3_BUCKET_NAME,
                ContentType: proofOfPaymentFile.mimetype!,
                // No public ACL. These are bank receipts, deposit slips and cheque

                // images; they are read through /api/files/proof-of-payment/{bookingId},

                // which checks ownership and issues a five-minute presigned URL.
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
            if (err1) {
                await transaction.rollback();
                return res.status(400).json({ success: false, message: err1.message });
            }

            if (data.paymentMethod) {
                booking.paymentMethod = data.paymentMethod as 'cheque' | 'beftn' | 'rtgs' | 'npsb' | 'cash';
                booking.idUserBanks = data.idUserBanks ? Number(data.idUserBanks) : undefined;
            }
            booking.proofOfPayment = proofOfPaymentFileName;
            booking.paymentConfirmationStatus = PROOF_SUBMITTED_WRITE_VALUE;
            booking.collectionRequired = data.paymentMethod === 'cheque' || data.paymentMethod === 'cash' ? 'yes' : 'no';
            booking.collectionStatus = data.paymentMethod === 'cheque' || data.paymentMethod === 'cash' ? 'pending' : null;
            booking.collectionDate = (data.paymentMethod === 'cheque' || data.paymentMethod === 'cash') && data.collectionDate ? new Date(new Date(data.collectionDate).getTime() - new Date().getTimezoneOffset() * 60000).toISOString() : null;
            booking.collectionLocation = data.paymentMethod === 'cheque' || data.paymentMethod === 'cash' ? data.collectionLocation : null;

            let [err2] = await _(booking.save({ transaction }));
            if (err2) {
                await transaction.rollback();
                return res.status(400).json({ success: false, message: err2.message });
            }

            if (booking.idProjectInvestmentBookings === undefined) {
                throw new Error('Booking ID is undefined');
            }
            const bookingStatus = await BookingStatusEntry('proof_of_payment_uploaded', booking.idProjectInvestmentBookings, userInfo.idUsers, '', transaction);
            if (!bookingStatus) {
                await transaction.rollback();
                throw new Error('Error updating booking status');
            }

            await transaction.commit();
            return res.status(200).json({ success: true, message: 'Proof of payment uploaded successfully' });

        });

    } catch (err) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: (err as Error).message });
    }
}

export const config = {
    api: {
        bodyParser: false,
    },
};

export default cors(handler as any);
