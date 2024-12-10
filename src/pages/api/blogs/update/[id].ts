import { NextApiRequest, NextApiResponse } from 'next';
import { Blog } from '@/models/__associations';
import Joi from 'joi';
import sequelize from '@/config/db';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '@/config/constants';
import JWTPayload from '@/types/JWTPayload';
import * as formidable from 'formidable';
import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { S3_BUCKET_ACCESS_KEY, S3_BUCKET_SECRET_KEY, S3_BUCKET_REGION, S3_BUCKET_NAME } from '@/config/constants';
import { generateHash } from '@/utils/GenerateHash';
import fs from 'fs';
import _ from 'await-to-js';
import sharp from 'sharp';
import path from 'path';
import os from 'os';

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
    heading: Joi.string().required().messages({
        "any.required": "Heading is required",
        "string.empty": "Heading can not be empty",
    }),
    description: Joi.string().required().messages({
        "any.required": "Description is required",
        "string.empty": "Description can not be empty",
    }),
    writtenBy: Joi.string().required().messages({
        "any.required": "Written by is required",
        "string.empty": "Written by can not be empty",
    }),
    writtenDate: Joi.date().required().messages({
        "any.required": "Written date is required",
        "date.base": "Written date can not be empty",
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

            const featuredImage = files['featuredImage'] ? files['featuredImage'][0] as formidable.File : null;

            const data = {
                heading: fields.heading ? fields.heading[0] : null,
                description: fields.description ? fields.description[0] : null,
                writtenBy: fields.writtenBy ? fields.writtenBy[0] : null,
                writtenDate: fields.writtenDate ? fields.writtenDate[0] : null
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

            if (featuredImage !== null) {
                if (featuredImage.mimetype !== 'image/jpeg' && featuredImage.mimetype !== 'image/png' && featuredImage.mimetype !== 'image/jpg') {
                    res.status(400).json({ message: `Invalid file type: ${featuredImage.mimetype}. Only JPEG, JPG and PNG files are allowed.` });
                    return;
                }
            }

            const params = {
                Bucket: S3_BUCKET_NAME,
                ACL: 'public-read'
            };

            const transaction = await sequelize.transaction();

            try {

                const prevData = await Blog.findByPk(req.query.id as string)

                let featuredImageFileName = '';
                let thumbImageFileName = '';
                if (featuredImage !== null) {
                    featuredImageFileName = generateHash(Date.now() + featuredImage.originalFilename!.toString()) + '.' + featuredImage.originalFilename!.split('.').pop();
                    thumbImageFileName = generateHash(Date.now() + featuredImage.originalFilename!.toString()) + '-thumb' + '.' + featuredImage.originalFilename!.split('.').pop();
                    const thumbImagePath = path.join(os.tmpdir(), thumbImageFileName);

                    await sharp(featuredImage.filepath)
                        .resize(400, 400, {
                            fit: 'inside'
                        })
                        .toFile(thumbImagePath)
                        .catch(err => console.log('Thumbnail generation error:', err));

                    const upload = new Upload({
                        client: s3Client,
                        params: { ...params, ContentType: featuredImage.mimetype!, Body: fs.createReadStream(featuredImage.filepath), Key: 'blog-featured-images/' + featuredImageFileName } as any
                    });


                    upload.on('httpUploadProgress', (progress: any) => {
                        console.log(`Uploaded ${progress.loaded} of ${progress.total} bytes`);
                    });
                    let [err1, result1] = await _(upload.done());
                    if (err1) {
                        await transaction.rollback();
                        return res.status(500).json({ success: false, message: err1.message });
                    }

                    const thumbUpload = new Upload({
                        client: s3Client,
                        params: { ...params, ContentType: featuredImage.mimetype!, Body: fs.createReadStream(thumbImagePath), Key: 'blog-featured-images/' + thumbImageFileName } as any
                    });

                    thumbUpload.on('httpUploadProgress', (progress: any) => {
                        console.log(`Uploaded ${progress.loaded} of ${progress.total} bytes`);
                    });
                    let [err2, result2] = await _(thumbUpload.done());

                    if (err2) {
                        await transaction.rollback();
                        return res.status(500).json({ success: false, message: err2.message });
                    }
                }


                const blog = await Blog.update({
                    heading: data.heading,
                    description: data.description,
                    writtenBy: data.writtenBy,
                    writtenDate: data.writtenDate,
                    featuredImage: featuredImage !== null ? featuredImageFileName : (prevData?.featuredImage !== null ? prevData?.featuredImage : null),
                    featuredImageThumb: featuredImage !== null ? thumbImageFileName : (prevData?.featuredImageThumb !== null ? prevData?.featuredImageThumb : null)
                }, { where: { idBlogs: req.query.id }, transaction })
                await transaction.commit();

                return res.status(200).json({ success: true, message: 'Blog updated successfully', data: blog })
            } catch (err) {
                await transaction.rollback();
                return res.status(500).json({ success: false, message: (err as Error).message })
            }
        });
    } else {
        res.status(405).json({ success: false, message: 'Method not allowed' });
    }
}

export default cors(handler as any);