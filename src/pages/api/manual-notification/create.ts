import { NextApiRequest, NextApiResponse } from 'next';
import { ManualNotification } from '@/models/__associations';
import Joi from 'joi';
import sequelize from '@/config/db';
import { S3_BUCKET_ACCESS_KEY, S3_BUCKET_SECRET_KEY, S3_BUCKET_REGION, S3_BUCKET_NAME } from '@/config/constants';
import { generateHash } from '@/utils/GenerateHash';
import * as formidable from 'formidable';
import fs from 'fs';
import _ from 'await-to-js';
import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import Cors from 'micro-cors';
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
const cors = Cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS', 'PUT'],
    allowHeaders: ['X-Requested-With', 'Authorization', 'Content-Type'],
});

export const config = {
    api: {
        bodyParser: false, // Disable Next.js's default body parser
    },
};

const schema = Joi.object({
    sendViaSms: Joi.string().required().valid('yes', 'no').messages({
        "any.required": "Send Via Sms is required",
        "string.empty": "Send Via Sms can not be empty",
        "any.only": "Invalid Send Via Sms",
    }),
    smsBody: Joi.when('sendViaSms', {
        is: 'yes',
        then: Joi.string().required().messages({
            "any.required": "Sms Body is required when Send Via Sms is 'yes'",
            "string.empty": "Sms Body cannot be empty",
        }),
        otherwise: Joi.optional(),
    }),
    sendViaEmail: Joi.string().required().valid('yes', 'no').messages({
        "any.required": "Send Via Email is required",
        "string.empty": "Send Via Email can not be empty",
        "any.only": "Invalid Send Via Email",
    }),
    emailSubject: Joi.when('sendViaEmail', {
        is: 'yes',
        then: Joi.string().required().messages({
            "any.required": "Email Subject is required when Send Via Email is 'yes'",
            "string.empty": "Email Subject cannot be empty",
        }),
        otherwise: Joi.optional(),
    }),
    emailBody: Joi.when('sendViaEmail', {
        is: 'yes',
        then: Joi.string().required().messages({
            "any.required": "Email Body is required when Send Via Email is 'yes'",
            "string.empty": "Email Body cannot be empty",
        }),
        otherwise: Joi.optional(),
    }),
    sendViaPush: Joi.string().required().valid('yes', 'no').messages({
        "any.required": "Send Via Push is required",
        "string.empty": "Send Via Push can not be empty",
        "any.only": "Invalid Send Via Push",
    }),
    pushNotificationBody: Joi.when('sendViaPush', {
        is: 'yes',
        then: Joi.string().required().messages({
            "any.required": "Push Notification Body is required when Send Via Push is 'yes'",
            "string.empty": "Push Notification Body cannot be empty",
        }),
        otherwise: Joi.optional(),
    }),
    pushNotificationTitle: Joi.when('sendViaPush', {
        is: 'yes',
        then: Joi.string().required().messages({
            "any.required": "Push Notification Title is required when Send Via Push is 'yes'",
            "string.empty": "Push Notification Title cannot be empty",
        }),
        otherwise: Joi.optional(),
    })
}).unknown();

async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'OPTIONS') { return res.status(200).end(); }
    if (req.method === 'POST') {
        let tokenData = req.headers.authorization;
        let token = tokenData?.split(' ')[1];

        if (!token || jwt.verify(token, JWT_SECRET) === null) { res.status(401).json({ success: false, message: 'Invalid token' }); return; }

        let userInfo = jwt.decode(token) as JWTPayload;
        if (userInfo.userType !== 'admin') { res.status(403).json({ success: false, message: 'Access denied' }); return; }

        const form = new formidable.IncomingForm();
        form.parse(req, async (err, fields, files) => {
            if (err) {
                return res.status(500).json({ success: false, message: err.message });
            }

            const pushNotificationImage = files['pushNotificationImage'] ? files['pushNotificationImage'][0] as formidable.File : null;
            const data = {
                sendViaSms: fields.sendViaSms ? fields.sendViaSms[0] : null,
                smsBody: fields.smsBody ? fields.smsBody[0] : null,
                sendViaEmail: fields.sendViaEmail ? fields.sendViaEmail[0] : null,
                emailSubject: fields.emailSubject ? fields.emailSubject[0] : null,
                emailBody: fields.emailBody ? fields.emailBody[0] : null,
                sendViaPush: fields.sendViaPush ? fields.sendViaPush[0] : null,
                pushNotificationBody: fields.pushNotificationBody ? fields.pushNotificationBody[0] : null,
                pushNotificationTitle: fields.pushNotificationTitle ? fields.pushNotificationTitle[0] : null,
                createdBy: fields.createdBy ? fields.createdBy[0] : null
            };

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


            if (pushNotificationImage !== null) {
                if (pushNotificationImage.mimetype !== 'image/jpeg' && pushNotificationImage.mimetype !== 'image/png' && pushNotificationImage.mimetype !== 'image/jpg') {
                    res.status(400).json({ message: `Invalid file type: ${pushNotificationImage.mimetype}. Only JPEG, JPG and PNG files are allowed.` });
                    return;
                }
            }

            const params = {
                Bucket: S3_BUCKET_NAME,
                ACL: 'public-read'
            };

            const transaction = await sequelize.transaction();
            try {
                let pushNotificationImageName = null;
                if (pushNotificationImage !== null) {
                    pushNotificationImageName = generateHash(Date.now() + pushNotificationImage.originalFilename!.toString()) + '.' + pushNotificationImage.originalFilename!.split('.').pop();
                    const upload = new Upload({
                        client: s3Client,
                        params: { ...params, ContentType: pushNotificationImage.mimetype!, Body: fs.createReadStream(pushNotificationImage.filepath), Key: 'push-notification/' + pushNotificationImageName } as any
                    });

                    upload.on('httpUploadProgress', (progress: any) => {
                        console.log(`Uploaded ${progress.loaded} of ${progress.total} bytes`);
                    });
                    let [err1] = await _(upload.done());
                    if (err1) {
                        await transaction.rollback();
                        return res.status(500).json({ success: false, message: "Push notification image upload error. " + err1.message });
                    }
                }

                const notification = await ManualNotification.create({
                    sendViaSms: data.sendViaSms,
                    smsBody: data.sendViaSms === 'yes' ? data.smsBody : null,
                    sendViaEmail: data.sendViaEmail,
                    emailSubject: data.sendViaEmail === 'yes' ? data.emailSubject : null,
                    emailBody: data.sendViaEmail === 'yes' ? data.emailBody : null,
                    sendViaPush: data.sendViaPush,
                    pushNotificationBody: data.sendViaPush === 'yes' ? data.pushNotificationBody : null,
                    pushNotificationTitle: data.sendViaPush === 'yes' ? data.pushNotificationTitle : null,
                    pushNotificationImage: (data.sendViaPush === 'yes' && pushNotificationImage !== null) ? pushNotificationImageName : null,
                    createdBy: data.createdBy
                }, { transaction });

                await transaction.commit();
                return res.status(200).json({ success: true, message: 'Manual Notification created successfully', data: notification });
            } catch (err) {
                await transaction.rollback();
                return res.status(500).json({ success: false, message: (err as Error).message });
            }
        });
    } else {
        res.status(405).json({ success: false, message: 'Method not allowed' });
    }
}

export default cors(handler as any);