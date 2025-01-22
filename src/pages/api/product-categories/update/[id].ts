import { NextApiRequest, NextApiResponse } from 'next';
import { ProductCategory } from '@/models/__associations';
import Joi from 'joi';
import { S3_BUCKET_ACCESS_KEY, S3_BUCKET_SECRET_KEY, S3_BUCKET_REGION, S3_BUCKET_NAME } from '@/config/constants';
import { generateHash } from '@/utils/GenerateHash';
import * as formidable from 'formidable';
import _ from 'await-to-js';
import fs from 'fs';
import sequelize from '@/config/db';
import { Op } from 'sequelize';
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


const S3_PARAMS = { Bucket: S3_BUCKET_NAME, ACL: 'public-read' };

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

const handleValidationError = (error: Joi.ValidationError) => {
    return error.details.map((e) => e.message).join(". <br>");
};

const processImage = async (categoryImage: formidable.File, categoryId: string) => {
    const categoryImageFileName = generateHash(Date.now() + categoryImage.originalFilename!.toString()) + '.' + categoryImage.originalFilename!.split('.').pop();
    const upload = new Upload({
        client: s3Client,
        params: {
            ...S3_PARAMS,
            ContentType: categoryImage.mimetype!,
            Body: fs.createReadStream(categoryImage.filepath),
            Key: `product-category-image/${categoryImageFileName}`,
        } as any,
    });

    upload.on('httpUploadProgress', (progress: any) => {
        console.log(`Uploaded ${progress.loaded} of ${progress.total} bytes`);
    });
    let [err1, result1] = await _(upload.done());
    if (err1) {
        throw new Error(err1.message);
    }

    return categoryImageFileName;
};

async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

    let tokenData = req.headers.authorization;
    let token = tokenData?.split(' ')[1];

    if (!token || jwt.verify(token, JWT_SECRET) === null) { res.status(401).json({ success: false, message: 'Invalid token' }); return; }

    let userInfo = jwt.decode(token) as JWTPayload;
    if (userInfo.userType !== 'admin') { res.status(403).json({ success: false, message: 'Access denied' }); return; }


    const form = new formidable.IncomingForm();
    form.parse(req, async (err, fields, files) => {
        if (err) return res.status(400).json({ success: false, message: err.message });

        const categoryImage = files['categoryImage'] ? files['categoryImage'][0] as formidable.File : null;
        const data = {
            productCategoryName: fields.productCategoryName ? fields.productCategoryName[0] : null,
            status: fields.status ? fields.status[0] : null,
        };

        const { error } = schema.validate(data, { abortEarly: false });
        if (error) return res.status(400).json({ success: false, message: handleValidationError(error) });

        const existingCategory = await ProductCategory.findOne({
            where: {
                productCategoryName: data.productCategoryName,
                idProductCategories: { [Op.ne]: req.query.id },
            },
        });

        if (existingCategory) {
            return res.status(400).json({ success: false, message: 'Category name already exists' });
        }

        if (fields.categoryImage === undefined && !categoryImage) {
            return res.status(400).json({ message: 'Category image is required' });
        }
        if (categoryImage && categoryImage.mimetype && !['image/jpeg', 'image/png', 'image/jpg'].includes(categoryImage.mimetype)) {
            return res.status(400).json({ message: `Invalid file type: ${categoryImage.mimetype}. Only JPEG, JPG, and PNG files are allowed.` });
        }

        const transaction = await sequelize.transaction();
        try {
            let categoryImageFileName = categoryImage ? await processImage(categoryImage, req.query.id as string) : (fields.categoryImage ?? [])[0];
            const productCategory = await ProductCategory.update({
                productCategoryName: data.productCategoryName,
                categoryImage: categoryImageFileName,
                productCategoryId: fields.productCategoryId ? fields.productCategoryId[0] : null,
                status: data.status,
            }, {
                where: { idProductCategories: req.query.id },
                transaction,
            });

            await transaction.commit();
            return res.status(200).json({ success: true, message: 'Product Category updated successfully', data: productCategory });
        } catch (err) {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: (err as Error).message });
        }
    });
}

export default cors(handler as any);