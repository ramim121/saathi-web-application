import { NextApiRequest, NextApiResponse } from 'next';
import { ProductCategory } from '@/models/__associations';
import Joi from 'joi';
import { S3_BUCKET_ACCESS_KEY, S3_BUCKET_SECRET_KEY, S3_BUCKET_REGION, S3_BUCKET_NAME } from '@/config/constants';
import { generateHash } from '@/utils/GenerateHash';
import { generateProductCategoryId } from '@/utils/GenerateProductCategoryId';
import * as formidable from 'formidable';
import fs from 'fs';
import _ from 'await-to-js';
import sequelize from '@/config/db';
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
    productCategoryName: Joi.string().required().messages({
        'string.empty': 'Category name is required',
        'any.required': 'Category name is required'
    }),
    status: Joi.string().valid('active', 'inactive').required().messages({
        'string.empty': 'Status is required',
        'any.required': 'Status is required',
        'any.only': 'Status must be either active or inactive'
    }),

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

            const categoryImage = files['categoryImage'] ? files['categoryImage'][0] as formidable.File : null;
            const data = {
                productCategoryName: fields.productCategoryName ? fields.productCategoryName[0] : null,
                status: fields.status ? fields.status[0] : null,
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

            const existingCategory = await ProductCategory.findOne({
                where: {
                    productCategoryName: data.productCategoryName
                }
            });

            if (existingCategory) {
                return res.status(400).json({ success: false, message: 'Category name already exists' });
            }

            if (categoryImage !== null) {
                if (categoryImage.mimetype !== 'image/jpeg' && categoryImage.mimetype !== 'image/png' && categoryImage.mimetype !== 'image/jpg') {
                    res.status(400).json({ message: `Invalid file type: ${categoryImage.mimetype}. Only JPEG, JPG and PNG files are allowed.` });
                    return;
                }
            }
            else {
                res.status(400).json({ message: `Category image is required` });
                return;
            }

            const params = {
                Bucket: S3_BUCKET_NAME,
                ACL: 'public-read'
            };

            const transaction = await sequelize.transaction();

            try {
                let categoryImageFileName = null;
                let productCategoryId = null;
                if (categoryImage !== null) {
                    categoryImageFileName = generateHash(Date.now() + categoryImage.originalFilename!.toString()) + '.' + categoryImage.originalFilename!.split('.').pop();
                }
                productCategoryId = await generateProductCategoryId();
                const productCategory = await ProductCategory.create({
                    productCategoryName: data.productCategoryName,
                    categoryImage: categoryImage !== null ? categoryImageFileName : null,
                    productCategoryId: productCategoryId,
                    status: data.status
                }, { transaction });

                const upload = new Upload({
                    client: s3Client,
                    params: { ...params, ContentType: categoryImage.mimetype!, Body: fs.createReadStream(categoryImage.filepath), Key: 'product-category-image/' + categoryImageFileName } as any
                });

                upload.on('httpUploadProgress', (progress: any) => {
                    console.log(`Uploaded ${progress.loaded} of ${progress.total} bytes`);
                });
                let [err1, result1] = await _(upload.done());
                if (err1) {
                    await transaction.rollback();
                    return res.status(400).json({ success: false, message: err1.message });
                }

                await transaction.commit();
                return res.status(200).json({ success: true, message: 'Product Category created successfully', data: productCategory });
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