import { NextApiRequest, NextApiResponse } from 'next';
import InvestorTestimonial from '@/models/InvestorTestimonial';
import Joi from 'joi';
import { S3_BUCKET_ACCESS_KEY, S3_BUCKET_SECRET_KEY, S3_BUCKET_REGION, S3_BUCKET_NAME, JWT_SECRET } from '@/config/constants';
import { generateHash } from '@/utils/GenerateHash';
import * as formidable from 'formidable';
import fs from 'fs';
import _ from 'await-to-js';
import sequelize from '@/config/db';
import { S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import jwt from 'jsonwebtoken';
import JWTPayload from '@/types/JWTPayload';
import Cors from 'micro-cors';

const s3Client = new S3Client({
    region: S3_BUCKET_REGION,
    credentials: {
        accessKeyId: S3_BUCKET_ACCESS_KEY,
        secretAccessKey: S3_BUCKET_SECRET_KEY
    }
});

const cors = Cors({
    origin: '*',
    allowMethods: ['POST', 'OPTIONS'],
    allowHeaders: ['X-Requested-With', 'Authorization', 'Content-Type'],
});

export const config = {
    api: {
        bodyParser: false,
    },
};

const schema = Joi.object({
    idInvestorTestimonials: Joi.number().required().messages({
        'number.base': 'Invalid testimonial',
        'any.required': 'Testimonial is required'
    }),
    name: Joi.string().required().messages({
        'string.empty': 'Name is required',
        'any.required': 'Name is required',
    }),
    rating: Joi.number().min(1).max(5).required().messages({
        'number.base': 'Rating must be a number',
        'number.empty': 'Rating is required',
        'any.required': 'Rating is required',
        'number.min': 'Rating must be at least 1',
        'number.max': 'Rating must be at most 5',
    }),
    testimonial: Joi.string().required().messages({
        'string.empty': 'Testimonial is required',
        'any.required': 'Testimonial is required',
    }),
    priority: Joi.number().required().messages({
        'number.base': 'Priority must be a number',
        'number.empty': 'Priority is required',
        'any.required': 'Priority is required'
    }),
    // Bangla counterparts — optional; null falls back to the English column.
    nameBn: Joi.string().optional().allow(null, ''),
    testimonialBn: Joi.string().optional().allow(null, '')
});

async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'OPTIONS') { return res.status(200).end(); }

    if (req.method === 'POST') {
        const tokenData = req.headers.authorization;
        const token = tokenData?.split(' ')[1];

        if (!token || jwt.verify(token, JWT_SECRET) === null) { res.status(401).json({ success: false, message: 'Invalid token' }); return; }

        const userInfo = jwt.decode(token) as JWTPayload;
        if (userInfo.userType !== 'admin') { res.status(403).json({ success: false, message: 'Access denied' }); return; }

        const form = new formidable.IncomingForm();
        form.parse(req, async (err, fields, files) => {
            if (err) {
                return res.status(400).json({ success: false, message: err.message });
            }

            const idInvestorTestimonials = fields.idInvestorTestimonials ? parseInt(fields.idInvestorTestimonials[0]) : null;
            const image = files['image'] ? files['image'][0] as formidable.File : null;

            const data = {
                idInvestorTestimonials,
                name: fields.name ? fields.name[0] : null,
                rating: fields.rating ? parseInt(fields.rating[0]) : null,
                testimonial: fields.testimonial ? fields.testimonial[0] : null,
                priority: fields.priority ? parseInt(fields.priority[0]) : null,
                nameBn: fields.nameBn ? fields.nameBn[0] : null,
                testimonialBn: fields.testimonialBn ? fields.testimonialBn[0] : null,
            };

            const options = {
                abortEarly: false,
            };
            const { error } = schema.validate(data, options);

            if (error) {
                const errorMessage: string[] = [];

                error.details.forEach((e) => {
                    errorMessage.push(e.message);
                });
                return res.status(400).json({ success: false, message: errorMessage.join(". <br>") });
            }

            const params = {
                Bucket: S3_BUCKET_NAME,
                ACL: 'public-read'
            };

            const transaction = await sequelize.transaction();

            try {
                const existing = await InvestorTestimonial.findByPk(idInvestorTestimonials!, { transaction });
                if (!existing) {
                    await transaction.rollback();
                    return res.status(404).json({ success: false, message: 'Investor testimonial not found' });
                }

                let imageFileName = existing.get('image') as string;

                if (image) {
                    imageFileName = generateHash(Date.now() + image.originalFilename!.toString()) + '.' + image.originalFilename!.split('.').pop();

                    const upload = new Upload({
                        client: s3Client,
                        params: { ...params, ContentType: image.mimetype!, Body: fs.createReadStream(image.filepath), Key: 'investor-testimonials/' + imageFileName } as any
                    });

                    const [err1] = await _(upload.done());
                    if (err1) {
                        await transaction.rollback();
                        return res.status(400).json({ success: false, message: err1.message });
                    }
                }

                await existing.update({
                    name: data.name,
                    image: imageFileName,
                    rating: data.rating,
                    testimonial: data.testimonial,
                    priority: data.priority,
                    nameBn: data.nameBn || null,
                    testimonialBn: data.testimonialBn || null
                }, { transaction });

                await transaction.commit();
                return res.status(200).json({ success: true, message: 'Investor testimonial updated successfully', data: existing });
            } catch (e) {
                await transaction.rollback();
                return res.status(400).json({ success: false, message: (e as Error).message });
            }
        });
    } else {
        res.status(405).json({ success: false, message: 'Method not allowed' });
    }
}

export default cors(handler as any);

