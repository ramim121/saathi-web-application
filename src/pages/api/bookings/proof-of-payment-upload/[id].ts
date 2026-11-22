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

/**
 * A receipt cannot be attached to a booking that is finished one way or the
 * other. Both used to be accepted: a second upload flipped a *confirmed*
 * booking back to "proof submitted" and reset its collection fields, and a
 * *cancelled* booking (units already released) took a receipt, inviting a
 * second payment for nothing. A denied booking may upload again; that is how
 * an investor answers a rejected receipt.
 */
function receiptBlocked(booking: { cancelled?: string | null; paymentConfirmationStatus?: string | null }): { code: string; message: string } | null {
    if (booking.cancelled === 'yes') {
        return { code: 'BOOKING_CANCELLED', message: 'This booking was cancelled, so it no longer takes a payment receipt.' };
    }
    if (booking.paymentConfirmationStatus === 'confirmed') {
        return { code: 'BOOKING_CONFIRMED', message: 'This booking is already confirmed. Contact DigiGram if its receipt needs to change.' };
    }
    return null;
}

function readToken(req: NextApiRequest): JWTPayload | null {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return null;
    try {
        jwt.verify(token, JWT_SECRET);
        return jwt.decode(token) as JWTPayload;
    } catch {
        // An expired or forged token used to throw out of the handler (a 500).
        return null;
    }
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'OPTIONS') { return res.status(200).end(); }

    const userInfo = readToken(req);
    if (!userInfo) {
        return res.status(401).json({ success: false, message: 'Invalid token' });
    }

    const booking = await ProjectInvestmentBooking.findByPk(String(req.query.id));
    if (!booking) {
        return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // SECURITY: the token was verified above, but the booking id comes from the
    // URL and was never checked against it — so any signed-in user could attach a
    // proof-of-payment file, a payment method and a bank account to somebody
    // else's booking. Admins keep the override because the admin panel records
    // offline payments on behalf of investors.
    if (userInfo.userType !== 'admin' && booking.idUsers !== userInfo.idUsers) {
        return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const blocked = receiptBlocked(booking);
    if (blocked) {
        return res.status(409).json({ success: false, ...blocked });
    }

    const form = new formidable.IncomingForm({ maxFileSize: 10 * 1024 * 1024 });

    form.parse(req, async (err, fields, files) => {
        // Every path answers: a throw inside this callback used to leave the
        // request hanging with no response.
        try {
            if (err) {
                return res.status(400).json({ success: false, message: err.message });
            }

            const data = {
                paymentMethod: fields.paymentMethod ? fields.paymentMethod[0] : null,
                collectionDate: fields.collectionDate ? fields.collectionDate[0] : null,
                collectionLocation: fields.collectionLocation ? fields.collectionLocation[0] : null,
                idUserBanks: fields.idUserBanks ? fields.idUserBanks[0] : null
            };

            const { error } = schema.validate(data, { abortEarly: false });
            if (error) {
                const errorMessage: string[] = error.details.map(e => e.message);
                return res.status(400).json({ success: false, message: errorMessage.join(". <br>") });
            }

            if (!files['proofOfPayment']) {
                return res.status(400).json({ success: false, message: 'Proof of payment is required' });
            }

            const proofOfPaymentFile = files['proofOfPayment']![0] as formidable.File;

            if (proofOfPaymentFile.mimetype !== 'image/jpeg' && proofOfPaymentFile.mimetype !== 'image/png') {
                return res.status(400).json({ success: false, message: `Invalid file type: ${proofOfPaymentFile.mimetype}. Only JPEG and PNG files are allowed.` });
            }

            const proofOfPaymentFileName = generateHash(Date.now() + (booking.idProjectInvestmentBookings?.toString() ?? '') + proofOfPaymentFile.originalFilename!.toString()) + '.' + proofOfPaymentFile.originalFilename!.split('.').pop();

            // Upload first, then open the transaction. The transaction used to be
            // held open for the whole S3 upload, tying up a database connection
            // for as long as a slow phone connection took.
            const upload = new Upload({
                client: s3Client,
                params: {
                    Bucket: S3_BUCKET_NAME,
                    ContentType: proofOfPaymentFile.mimetype!,
                    // No public ACL. These are bank receipts, deposit slips and cheque
                    // images; they are read through /api/files/proof-of-payment/{bookingId},
                    // which checks ownership and issues a five-minute presigned URL.
                    Body: fs.createReadStream(proofOfPaymentFile.filepath),
                    Key: 'proof-of-payment/' + proofOfPaymentFileName
                } as any
            });
            const [uploadError] = await _(upload.done());
            if (uploadError) {
                return res.status(400).json({ success: false, message: uploadError.message });
            }

            const transaction = await sequelize.transaction();
            try {
                // Re-read under a row lock: the booking may have been confirmed or
                // cancelled while the file was uploading.
                const current = await ProjectInvestmentBooking.findByPk(booking.idProjectInvestmentBookings!, { transaction, lock: transaction.LOCK.UPDATE });
                if (!current) {
                    await transaction.rollback();
                    return res.status(404).json({ success: false, message: 'Booking not found' });
                }
                const lateBlock = receiptBlocked(current);
                if (lateBlock) {
                    await transaction.rollback();
                    return res.status(409).json({ success: false, ...lateBlock });
                }

                const cashOrCheque = data.paymentMethod === 'cheque' || data.paymentMethod === 'cash';
                if (data.paymentMethod) {
                    current.paymentMethod = data.paymentMethod as 'cheque' | 'beftn' | 'rtgs' | 'npsb' | 'cash';
                    current.idUserBanks = data.idUserBanks ? Number(data.idUserBanks) : undefined;
                }
                current.proofOfPayment = proofOfPaymentFileName;
                current.paymentConfirmationStatus = PROOF_SUBMITTED_WRITE_VALUE;
                current.collectionRequired = cashOrCheque ? 'yes' : 'no';
                current.collectionStatus = cashOrCheque ? 'pending' : null;
                current.collectionDate = cashOrCheque && data.collectionDate ? new Date(new Date(data.collectionDate).getTime() - new Date().getTimezoneOffset() * 60000).toISOString() : null;
                current.collectionLocation = cashOrCheque ? data.collectionLocation : null;

                await current.save({ transaction });

                const bookingStatus = await BookingStatusEntry('proof_of_payment_uploaded', current.idProjectInvestmentBookings!, userInfo.idUsers, '', transaction);
                if (!bookingStatus) {
                    throw new Error('Error updating booking status');
                }

                await transaction.commit();
            } catch (dbError) {
                await transaction.rollback().catch(() => undefined);
                throw dbError;
            }

            return res.status(200).json({ success: true, message: 'Proof of payment uploaded successfully' });
        } catch (callbackError) {
            if (!res.headersSent) {
                return res.status(400).json({ success: false, message: (callbackError as Error).message });
            }
        }
    });
}

export const config = {
    api: {
        bodyParser: false,
    },
};

export default cors(handler as any);
