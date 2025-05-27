import { NextApiRequest, NextApiResponse } from 'next';
import { ProductImage } from '@/models/__associations';
import { S3_BUCKET_ACCESS_KEY, S3_BUCKET_SECRET_KEY, S3_BUCKET_REGION, S3_BUCKET_NAME } from '@/config/constants';
import { generateHash } from '@/utils/GenerateHash';
import * as formidable from 'formidable';
import fs from 'fs';
import _ from 'await-to-js';
import sequelize from '@/config/db';
import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import sharp from 'sharp';
import path from 'path';
import os from 'os';
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

            const data = {
                idProducts: fields.idProducts ? fields.idProducts[0] : null,
            }

            const productImages = files['productImages'] ? files['productImages'] as formidable.File[] : [];

            if (productImages.length > 0) {
                productImages.forEach((file: formidable.File) => {
                    if (file.mimetype !== 'image/jpeg' && file.mimetype !== 'image/png' && file.mimetype !== 'image/jpg') {
                        res.status(400).json({ message: `Invalid file type: ${file.mimetype}. Only JPEG, JPG and PNG files are allowed.` });
                        return;
                    }
                });
            }

            else {
                res.status(400).json({ message: 'Product images are required' });
                return;
            }


            const params = {
                Bucket: S3_BUCKET_NAME,
                ACL: 'public-read'
            };

            const transaction = await sequelize.transaction();

            try {
                for (const file of productImages) {
                    const productImageFileName = generateHash(Date.now() + file.originalFilename!.toString()) + '.' + file.originalFilename!.split('.').pop();
                    const productImageThumbFileName = generateHash(Date.now() + file.originalFilename!.toString()) + '-thumb.' + file.originalFilename!.split('.').pop();
                    const productImageThumbPath = path.join(os.tmpdir(), productImageThumbFileName);

                    await sharp(file.filepath)
                        .resize(400, 400, {
                            fit: 'inside'
                        })
                        .toFile(productImageThumbPath)
                        .catch(err => console.log('Thumbnail generation error:', err));

                    const upload = new Upload({
                        client: s3Client,
                        params: { ...params, ContentType: file.mimetype!, Body: fs.createReadStream(file.filepath), Key: 'product-image/' + data.idProducts + '/' + productImageFileName } as any
                    });

                    const thumbUpload = new Upload({
                        client: s3Client,
                        params: { ...params, ContentType: file.mimetype!, Body: fs.createReadStream(productImageThumbPath), Key: 'product-image/' + data.idProducts + '/' + productImageThumbFileName } as any
                    });

                    upload.on('httpUploadProgress', (progress: any) => {
                        console.log(`Uploaded ${progress.loaded} of ${progress.total} bytes`);
                    });

                    let [err2] = await _(upload.done());
                    if (err2) {
                        await transaction.rollback();
                        return res.status(400).json({ success: false, message: "Product image upload error. " + err2.message });
                    }

                    thumbUpload.on('httpUploadProgress', (progress: any) => {
                        console.log(`Uploaded ${progress.loaded} of ${progress.total} bytes`);
                    });

                    let [err3] = await _(thumbUpload.done());
                    if (err3) {
                        await transaction.rollback();
                        return res.status(400).json({ success: false, message: "Product image thumbnail upload error. " + err3.message });
                    }

                    await ProductImage.create({
                        imageName: productImageFileName,
                        imageNameOriginal: file.originalFilename,
                        thumbnail: productImageThumbFileName,
                        idProducts: data.idProducts,
                        imageStatus: 'active',
                        default: 'yes'
                    }, { transaction });
                }

                await transaction.commit();
                return res.status(200).json({ success: true, message: 'Product Category created successfully' });
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