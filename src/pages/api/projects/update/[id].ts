import { NextApiRequest, NextApiResponse } from 'next';
import { Project, File } from '@/models/__associations';
import { Op } from 'sequelize';
import Joi from 'joi';
import sequelize from '@/config/db';
import { S3_BUCKET_ACCESS_KEY, S3_BUCKET_SECRET_KEY, S3_BUCKET_REGION, S3_BUCKET_NAME } from '@/config/constants';
import { generateHash } from '@/utils/GenerateHash';
import * as formidable from 'formidable';
import fs from 'fs';
import _ from 'await-to-js';
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

const schema = Joi.object({
    projectName: Joi.string().required().messages({
        "any.required": "Project name is required",
        "string.empty": "Project name can not be empty",
    }),
    location: Joi.string().required().messages({
        "any.required": "Location is required",
        "string.empty": "Location can not be empty",
    }),
    collectionStarts: Joi.date().required().messages({
        "any.required": "Collection starts is required",
        "date.base": "Collection starts must be a date",
    }),
    collectionEnds: Joi.date().required().messages({
        "any.required": "Collection ends is required",
        "date.base": "Collection ends must be a date",
    }),
    projectCategory: Joi.number().min(1).required().messages({
        "any.required": "Project Category is required",
        "number.base": "Project Category must be selected",
        "number.min": "Project Category must be selected",
    }),
    // totalAvailableUnits: Joi.number().min(1).required().messages({
    //     "any.required": "Total available units is required",
    //     "number.base": "Total available units must be a number",
    //     "number.min": "Total available units must be greater than 0",
    // }),
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

            const data = {
                projectName: fields.projectName ? fields.projectName[0].toString() : null,
                location: fields.location ? fields.location[0] : null,
                collectionStarts: fields.collectionStarts ? fields.collectionStarts[0] : null,
                collectionEnds: fields.collectionEnds ? fields.collectionEnds[0] : null,
                otherLocations: fields.otherLocations ? fields.otherLocations[0] : null,
                summary: fields.summary ? fields.summary[0] : null,
                // Bangla counterparts — see the note in create.ts about `description`.
                projectNameBn: fields.projectNameBn ? fields.projectNameBn[0].toString() : null,
                summaryBn: fields.summaryBn ? fields.summaryBn[0] : null,
                locationBn: fields.locationBn ? fields.locationBn[0] : null,
                otherLocationsBn: fields.otherLocationsBn ? fields.otherLocationsBn[0] : null,
                showInUpcoming: fields.showInUpcoming ? fields.showInUpcoming[0] : null,
                projectCategory: fields.projectCategory ? fields.projectCategory[0] : null,
                prevFeaturedImages: fields.prevFeaturedImages ? fields.prevFeaturedImages : [],
                // totalAvailableUnits: fields.totalAvailableUnits ? fields.totalAvailableUnits[0] : null,
                investorUnitCapacity: fields.investorUnitCapacity ? fields.investorUnitCapacity[0] : null,
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

            const projectExists = await Project.findOne({
                where: {
                    projectName: data.projectName,
                    idProjects: {
                        [Op.not]: req.query.id
                    }
                }
            });

            if (projectExists) {
                return res.status(400).json({ message: 'Project already exists' });
            }

            const mainImage = files['mainImage'] ? files['mainImage'][0] as formidable.File : null;
            const featuredImages = files['featuredImages'] ? files['featuredImages'] as formidable.File[] : [];

            if (mainImage && mainImage.mimetype && !['image/jpeg', 'image/png', 'image/jpg'].includes(mainImage.mimetype)) {
                return res.status(400).json({ message: `Invalid file type: ${mainImage.mimetype}. Only JPEG, JPG, and PNG files are allowed.` });
            }

            if (featuredImages.length > 0) {
                featuredImages.forEach((file: formidable.File) => {
                    if (file.mimetype !== 'image/jpeg' && file.mimetype !== 'image/png' && file.mimetype !== 'image/jpg') {
                        res.status(400).json({ message: `Invalid file type: ${file.mimetype}. Only JPEG, JPG and PNG files are allowed.` });
                        return;
                    }
                }
                )
            }
            const params = {
                Bucket: S3_BUCKET_NAME,
                ACL: 'public-read'
            };

            const transaction = await sequelize.transaction();
            try {

                const project = await Project.update({
                    projectName: data.projectName,
                    location: data.location,
                    collectionStarts: data.collectionStarts,
                    collectionEnds: data.collectionEnds,
                    otherLocations: data.otherLocations,
                    summary: data.summary,
                    projectNameBn: data.projectNameBn || null,
                    summaryBn: data.summaryBn || null,
                    locationBn: data.locationBn || null,
                    otherLocationsBn: data.otherLocationsBn || null,
                    showInUpcoming: data.showInUpcoming,
                    projectCategory: data.projectCategory,
                    // totalAvailableUnits: data.totalAvailableUnits,
                    investorUnitCapacity: data.investorUnitCapacity
                }, {
                    where: { idProjects: req.query.id },
                    transaction
                });

                if (mainImage !== null) {

                    let previousMainImage = await File.findOne({
                        where: {
                            refType: 'project-main-image',
                            refId: req.query.id
                        }
                    });

                    if (previousMainImage) {
                        await File.destroy({
                            where: {
                                refType: 'project-main-image',
                                refId: req.query.id
                            }
                        });
                    }

                    const mainImageFileName = generateHash(Date.now() + mainImage.originalFilename!.toString()) + '.' + mainImage.originalFilename!.split('.').pop();
                    const thumbImageFileName = generateHash(Date.now() + mainImage.originalFilename!.toString() + '-thumb') + '.' + mainImage.originalFilename!.split('.').pop();
                    const thumbImagePath = path.join(os.tmpdir(), thumbImageFileName);
                    await sharp(mainImage.filepath)
                        .resize(400, 400, {
                            fit: 'inside'
                        })
                        .toFile(thumbImagePath)
                        .catch(err => console.log('Thumbnail generation error:', err));

                    const upload = new Upload({
                        client: s3Client,
                        params: { ...params, ContentType: mainImage.mimetype!, Body: fs.createReadStream(mainImage.filepath), Key: 'project-main-image/' + req.query.id + '/' + mainImageFileName } as any
                    });

                    const thumbUpload = new Upload({
                        client: s3Client,
                        params: { ...params, ContentType: mainImage.mimetype!, Body: fs.createReadStream(thumbImagePath), Key: 'project-main-image/' + req.query.id + '/' + thumbImageFileName } as any
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
                        originalFileName: mainImage.originalFilename!,
                        fileName: mainImageFileName,
                        thumbnail: thumbImageFileName,
                        refType: 'project-main-image',
                        refId: req.query.id
                    }, { transaction });
                }

                if (data.prevFeaturedImages.length > 0) {
                    const [err, file] = await _(
                        File.destroy({
                            where: {
                                refType: 'project-featured-image',
                                refId: req.query.id,
                                idFiles: {
                                    [Op.notIn]: Array.isArray(data.prevFeaturedImages) ? data.prevFeaturedImages : [data.prevFeaturedImages]
                                }
                            },
                            transaction
                        })
                    );
                    if (err) {
                        return { success: false, message: err.message };
                    }
                } else {
                    const [err, file] = await _(File.destroy({
                        where: {
                            refType: 'project-featured-image',
                            refId: req.query.id,
                        },
                        transaction
                    }))

                    if (err) {
                        return { success: false, message: err.message };
                    }
                }

                if (featuredImages.length > 0) {
                    for (const file of featuredImages) {
                        const featuredImageFileName = generateHash(Date.now() + file.originalFilename!.toString()) + '.' + file.originalFilename!.split('.').pop();
                        const featuredImageThumbFileName = generateHash(Date.now() + file.originalFilename!.toString() + '-thumb') + '.' + file.originalFilename!.split('.').pop();
                        const featuredImageThumbImagePath = path.join(os.tmpdir(), featuredImageThumbFileName);
                        await sharp(file.filepath)
                            .resize(400, 400, {
                                fit: 'inside'
                            })
                            .toFile(featuredImageThumbImagePath)
                            .catch(err => console.log('Thumbnail generation error:', err));

                        const upload = new Upload({
                            client: s3Client,
                            params: { ...params, ContentType: file.mimetype!, Body: fs.createReadStream(file.filepath), Key: 'project-featured-image/' + req.query.id + '/' + featuredImageFileName } as any
                        });

                        const thumbUpload = new Upload({
                            client: s3Client,
                            params: { ...params, ContentType: file.mimetype!, Body: fs.createReadStream(featuredImageThumbImagePath), Key: 'project-featured-image/' + req.query.id + '/' + featuredImageThumbFileName } as any
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
                            originalFileName: file.originalFilename!,
                            fileName: featuredImageFileName,
                            thumbnail: featuredImageThumbFileName,
                            refType: 'project-featured-image',
                            refId: req.query.id
                        }, { transaction });
                    }
                }

                await transaction.commit();
                return res.status(200).json({ success: true, message: 'Project updated successfully', data: project });
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