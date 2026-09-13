import { NextApiRequest, NextApiResponse } from 'next';
import { AppStatPanel } from '@/models/__associations';
import Joi from 'joi';
import { S3_BUCKET_ACCESS_KEY, S3_BUCKET_SECRET_KEY, S3_BUCKET_REGION, S3_BUCKET_NAME } from '@/config/constants';
import { generateHash } from '@/utils/GenerateHash';
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
    statType: Joi.string().valid('text', 'number', 'image').required().messages({
        'string.empty': 'Type is required',
        'any.required': 'Type is required',
        'any.only': 'Type must be selected'
    }),
    statLabel: Joi.string().required().messages({
        'string.empty': 'Label is required',
        'any.required': 'Label is required'
    }),
    statValue: Joi.alternatives().conditional('statType', {
        is: 'text',
        then: Joi.string().required().messages({
            'string.empty': 'Value is required',
            'any.required': 'Value is required'
        }),
        otherwise: Joi.alternatives().conditional('statType', {
            is: 'number',
            then: Joi.string().required().messages({
                'string.empty': 'Value is required',
                'any.required': 'Value is required'
            }),
            otherwise: Joi.alternatives().conditional('statType', {
                is: 'image',
                then: Joi.object({
                    originalFilename: Joi.string().required(),
                    mimetype: Joi.string().valid('image/jpeg', 'image/png', 'image/jpg').required(),
                }).required().messages({
                    'object.base': 'Value must be a file',
                }).unknown()
            })
        })
    }),
    priority: Joi.number().required().messages({
        'number.base': 'Priority must be a number',
        'number.empty': 'Priority is required',
        'any.required': 'Priority is required'
    }),
    // Bangla counterparts — optional; null falls back to the English column.
    // Only meaningful for statType 'text' / 'number'; an 'image' row has no
    // translatable copy.
    statLabelBn: Joi.string().optional().allow(null, ''),
    statValueBn: Joi.string().optional().allow(null, '')
});

async function handler(req: NextApiRequest, res: NextApiResponse) {
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

            let statValue = null;
            if (fields.statType && fields.statType[0] === 'image') {
                statValue = files['statValue'] ? files['statValue'][0] as formidable.File : null;
            }
            else {
                statValue = fields.statValue ? fields.statValue[0] : null;
            }
            const data = {
                statLabel: fields.statLabel ? fields.statLabel[0] : null,
                statType: fields.statType ? fields.statType[0] : null,
                statValue: statValue,
                priority: fields.priority ? fields.priority[0] : null,
                statLabelBn: fields.statLabelBn ? fields.statLabelBn[0] : null,
                statValueBn: fields.statValueBn ? fields.statValueBn[0] : null
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

            const params = {
                Bucket: S3_BUCKET_NAME,
                ACL: 'public-read'
            };

            const transaction = await sequelize.transaction();

            try {
                let statValueFileName = '';
                if (data.statType === 'image') {
                    if (statValue && typeof statValue !== 'string') {
                        statValueFileName = generateHash(Date.now() + statValue.originalFilename!.toString()) + '.' + statValue.originalFilename!.split('.').pop();

                        const upload = new Upload({
                            client: s3Client,
                            params: { ...params, ContentType: statValue.mimetype!, Body: fs.createReadStream(statValue.filepath), Key: 'stat-panel/' + statValueFileName } as any
                        });

                        upload.on('httpUploadProgress', (progress: any) => {
                            console.log(`Uploaded ${progress.loaded} of ${progress.total} bytes`);
                        });
                        let [err1, result1] = await _(upload.done());
                        if (err1) {
                            await transaction.rollback();
                            return res.status(400).json({ success: false, message: err1.message });
                        }
                    } else {
                        throw new Error('Invalid statValue type');
                    }
                }

                const statPanel = await AppStatPanel.create({
                    statType: data.statType,
                    statLabel: data.statLabel,
                    statValue: data.statType === 'image' ? statValueFileName : data.statValue,
                    priority: data.priority,
                    statLabelBn: data.statLabelBn || null,
                    // An image row's "value" is a filename, not copy — never translated.
                    statValueBn: data.statType === 'image' ? null : (data.statValueBn || null)
                }, { transaction });

                await transaction.commit();
                return res.status(200).json({ success: true, message: 'Stat created successfully', data: statPanel });
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