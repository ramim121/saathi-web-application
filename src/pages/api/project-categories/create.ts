import { NextApiRequest, NextApiResponse } from 'next';
import { ProjectCategory } from '@/models/__associations';
import Joi from 'joi';
import { S3_BUCKET_ACCESS_KEY, S3_BUCKET_SECRET_KEY, S3_BUCKET_REGION, S3_BUCKET_NAME } from '@/config/constants';
import { generateHash } from '@/utils/GenerateHash';
import * as formidable from 'formidable';
import fs from 'fs';
import _ from 'await-to-js';
import sequelize from '@/config/db';

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
    categoryName: Joi.string().required().messages({
        'string.empty': 'Category Name is required',
        'any.required': 'Category Name is required'
    }),
}).unknown();

async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'OPTIONS') { return res.status(200).end(); }
    if (req.method === 'POST') {

        const form = new formidable.IncomingForm();
        form.parse(req, async (err, fields, files) => {
            if (err) {
                return res.status(500).json({ success: false, message: err.message });
            }

            const categoryImage = files['categoryImage'] ? files['categoryImage'][0] as formidable.File : null;

            const data = {
                categoryName: fields['categoryName'] ? fields['categoryName'][0].toString() : '',
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

            const existingCategory = await ProjectCategory.findOne({ where: { categoryName: data.categoryName } });
            if (existingCategory) {
                return res.status(400).json({ success: false, message: 'Project Category already exists' });
            }

            if (categoryImage !== null) {
                if (categoryImage.mimetype !== 'image/jpeg' && categoryImage.mimetype !== 'image/png' && categoryImage.mimetype !== 'image/jpg') {
                    res.status(400).json({ message: `Invalid file type: ${categoryImage.mimetype}. Only JPEG, JPG and PNG files are allowed.` });
                    return;
                }
            }

            const params = {
                Bucket: S3_BUCKET_NAME,
                ACL: 'public-read'
            };

            const transaction = await sequelize.transaction();

            try {
                let categoryImageFileName = '';
                if (categoryImage !== null) {
                    categoryImageFileName = generateHash(Date.now() + categoryImage.originalFilename!.toString()) + '.' + categoryImage.originalFilename!.split('.').pop();
                    
                    const upload = new Upload({
                        client: s3Client,
                        params: { ...params, ContentType: categoryImage.mimetype!, Body: fs.createReadStream(categoryImage.filepath), Key: 'project-category-image/' + categoryImageFileName } as any
                    });
            
                    upload.on('httpUploadProgress', (progress: any) => {
                        console.log(`Uploaded ${progress.loaded} of ${progress.total} bytes`);
                    });
                    let [err1, result1] = await _(upload.done());                    
                    if (err1) {
                        await transaction.rollback();
                        return res.status(500).json({ success: false, message: err1.message });
                    }
                }

                const category = await ProjectCategory.create({
                    categoryName: data.categoryName,
                    categoryImage: categoryImage !== null ? categoryImageFileName : null
                }, { transaction });

                await transaction.commit();
                return res.status(200).json({ success: true, message: 'Project category successfully', data: category });
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