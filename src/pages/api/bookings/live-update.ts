import { NextApiRequest, NextApiResponse } from 'next';
import { ProjectPartnerInvestorUpdate, File } from '@/models/__associations';
import Joi from 'joi';
import sequelize from '@/config/db';
import { S3_BUCKET_ACCESS_KEY, S3_BUCKET_SECRET_KEY, S3_BUCKET_REGION, S3_BUCKET_NAME } from '@/config/constants';
import { generateHash } from '@/utils/GenerateHash';
import * as formidable from 'formidable';
import fs from 'fs';
import _ from 'await-to-js';
import sharp from 'sharp';
import path from 'path';
import os from 'os';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '@/config/constants';
import JWTPayload from '@/types/JWTPayload';
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

export const config = {
    api: {
        bodyParser: false,
    },
};

const schema = Joi.object({
    idProjectPartnerInvestors: Joi.string().required().messages({
        "any.required": "Project partner investor is required",
    }),
    updateDate: Joi.date().required().messages({
        "any.required": "Update date is required",
        "date.base": "Invalid date",
    }),
    updateBody: Joi.string().required().messages({
        "any.required": "Update body is required",
        "string.empty": "Update body is required",
    }),
    updateTitle: Joi.string().required().messages({
        "any.required": "Update title is required",
        "string.empty": "Update title is required",
    }),
    updateImage: Joi.string().optional()
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
                return res.status(400).json({ success: false, message: err.message });
            }

            const updateImage = files['updateImage'] ? files['updateImage'][0] as formidable.File : null;

            const data = {
                idProjectPartnerInvestors: fields.idProjectPartnerInvestors ? fields.idProjectPartnerInvestors[0] : null,
                liveWeight: fields.liveWeight ? fields.liveWeight[0] : null,
                updateDate: fields.updateDate ? fields.updateDate[0] : null,
                updateBody: fields.updateBody ? fields.updateBody[0] : null,
                updateTitle: fields.updateTitle ? fields.updateTitle[0] : null,
                videoUrl: fields.videoUrl ? fields.videoUrl[0] : null,
            }

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

            if (updateImage !== null) {
                if (updateImage.mimetype !== 'image/jpeg' && updateImage.mimetype !== 'image/png' && updateImage.mimetype !== 'image/jpg') {
                    res.status(400).json({ message: `Invalid file type: ${updateImage.mimetype}. Only JPEG, JPG and PNG files are allowed.` });
                    return;
                }

            }

            const params = {
                Bucket: S3_BUCKET_NAME,
                ACL: 'public-read'
            };

            const transaction = await sequelize.transaction();
            try {
                const liveUpdate = await ProjectPartnerInvestorUpdate.create({
                    idProjectPartnerInvestors: data.idProjectPartnerInvestors,
                    liveWeight: data.liveWeight,
                    updateDate: data.updateDate,
                    updateBody: data.updateBody,
                    updateTitle: data.updateTitle,
                    videoUrl: data.videoUrl
                }, { transaction });

                if (updateImage !== null) {
                    const updateImageFileName = generateHash(Date.now() + updateImage.originalFilename!.toString()) + '.' + updateImage.originalFilename!.split('.').pop();
                    const thumbImageFileName = generateHash(Date.now() + updateImage.originalFilename!.toString()) + '-thumb' + '.' + updateImage.originalFilename!.split('.').pop();
                    const thumbImagePath = path.join(os.tmpdir(), thumbImageFileName);
                    await sharp(updateImage.filepath)
                        .resize(400, 400, {
                            fit: 'inside'
                        })
                        .toFile(thumbImagePath)
                        .catch(err => console.log('Thumbnail generation error:', err));

                    const upload = new Upload({
                        client: s3Client,
                        params: { ...params, ContentType: updateImage.mimetype!, Body: fs.createReadStream(updateImage.filepath), Key: 'live-update/' + liveUpdate.idProjectPartnerInvestorUpdates + '/' + updateImageFileName } as any
                    });

                    const thumbUpload = new Upload({
                        client: s3Client,
                        params: { ...params, ContentType: updateImage.mimetype!, Body: fs.createReadStream(thumbImagePath), Key: 'live-update/' + liveUpdate.idProjectPartnerInvestorUpdates + '/' + thumbImageFileName } as any
                    });


                    upload.on('httpUploadProgress', (progress: any) => {
                        console.log(`Uploaded ${progress.loaded} of ${progress.total} bytes`);
                    });
                    let [err1, result1] = await _(upload.done());

                    if (err1) {
                        await transaction.rollback();
                        return res.status(400).json({ success: false, message: err1.message });
                    }

                    thumbUpload.on('httpUploadProgress', (progress: any) => {
                        console.log(`Uploaded ${progress.loaded} of ${progress.total} bytes`);
                    });
                    let [err2, result2] = await _(thumbUpload.done());

                    if (err2) {
                        await transaction.rollback();
                        return res.status(400).json({ success: false, message: err2.message });
                    }

                    await File.create({
                        originalFileName: updateImage.originalFilename!,
                        fileName: updateImageFileName,
                        thumbnail: thumbImageFileName,
                        refType: 'live-update',
                        refId: liveUpdate.idProjectPartnerInvestorUpdates
                    }, { transaction });
                }

                await transaction.commit();
                return res.status(200).json({ success: true, message: 'Live update created successfully', data: liveUpdate });
            } catch (err) {
                await transaction.rollback();
                return res.status(400).json({ success: false, message: (err as Error).message });
            }
        });
    } else {
        res.status(405).json({ success: false, message: 'Method not allowed' });
    }
}

export default cors(handler as any);