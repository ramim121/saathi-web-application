import { NextApiRequest, NextApiResponse } from 'next';
import { Project, File } from '@/models/__associations';
import Joi from 'joi';
import sequelize from '@/config/db';
import { S3_BUCKET_ACCESS_KEY, S3_BUCKET_SECRET_KEY, S3_BUCKET_REGION, S3_BUCKET_NAME } from '@/config/constants';
import { generateHash } from '@/utils/GenerateHash';
import * as formidable from 'formidable';
import fs from 'fs';
import AWS from 'aws-sdk';
import _ from 'await-to-js';

AWS.config.update({
    accessKeyId: S3_BUCKET_ACCESS_KEY,
    secretAccessKey: S3_BUCKET_SECRET_KEY,
    region: S3_BUCKET_REGION,
});

// Create an S3 instance
const s3 = new AWS.S3();

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
    unitInvestmentValue: Joi.number().min(1).required().messages({
        "any.required": "Unit investment value is required",
        "number.base": "Share/Unit must be a number",
        "number.min": "Share/Unit must be at least 1",
    }),
    location: Joi.string().required().messages({
        "any.required": "Location is required",
        "string.empty": "Location can not be empty",
    }),
    investment: Joi.object({
        minimumReturn: Joi.number().optional().messages({
            "number.base": "Minimum return must be a number",
        }),
        maximumReturn: Joi.number().optional().messages({
            "number.base": "Maximum return must be a number",
        }),
        investmentType: Joi.string().valid('high_return', 'low_return', 'short_duration', 'long_duration', 'shariah').required().empty().messages({
            "any.required": "Investment type is required",
            "any.only": "Invalid investment type",
            "string.empty": "Investment type can not be empty",
        }),
        returnType: Joi.string().valid('variable', 'fixed').required().messages({
            "any.required": "Return type is required",
            "any.only": "Invalid return type",
        }),
        duration: Joi.number().required().messages({
            "any.required": "Duration is required",
            "number.base": "Duration must be a number",
        }),
        tenure: Joi.string().required().messages({
            "any.required": "Tenure is required",
            "string.empty": "Tenure can not be empty",
        }),
        label: Joi.string().optional().messages({
            "string.empty": "Label can not be empty",
        }),
        value: Joi.number().optional().messages({
            "number.base": "Value must be a number",
        }),
    }).required().messages({
        "any.required": "Investment is required",
    }),
    totalReturnMax: Joi.number().required().messages({
        "any.required": "Total return max is required",
        "number.base": "Total return max must be a number",
    }),
    totalReturnMin: Joi.number().required().messages({
        "any.required": "Total return min is required",
        "number.base": "Total return min must be a number",
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
        "number.base": "Project Category must be a number",
        "number.min": "Project Category must be greater than 0",
    }),
}).unknown();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'POST') {

        const form = new formidable.IncomingForm();
        form.parse(req, async (err, fields, files) => {
            if (err) {
                return res.status(500).json({ success: false, message: err.message });
            }

            const mainImage = files['mainImage'] ? files['mainImage'][0] as formidable.File : null;
            const featuredImages = files['featuredImages'] ? files['featuredImages'] as formidable.File[] : [];
            const investmentFields = fields.investment && fields.investment.length > 0 ? JSON.parse(fields.investment[0]) : null;


            const data = {
                projectName: fields.projectName ? fields.projectName[0].toString() : null,
                unitInvestmentValue: fields.unitInvestmentValue ? fields.unitInvestmentValue[0] : null,
                investment: {
                    minimumReturn: investmentFields.minimumReturn ? parseInt(investmentFields.minimumReturn) : null,
                    maximumReturn: investmentFields.maximumReturn ? parseInt(investmentFields.maximumReturn) : null,
                    investmentType: investmentFields.investmentType,
                    returnType: investmentFields.returnType,
                    duration: investmentFields.duration ? parseInt(investmentFields.duration) : null,
                    tenure: investmentFields.tenure,
                    label: investmentFields.label,
                    value: investmentFields.value ? parseInt(investmentFields.value) : null
                },
                location: fields.location ? fields.location[0] : null,
                totalReturnMax: fields.totalReturnMax ? fields.totalReturnMax[0] : null,
                totalReturnMin: fields.totalReturnMin ? fields.totalReturnMin[0] : null,
                collectionStarts: fields.collectionStarts ? fields.collectionStarts[0] : null,
                collectionEnds: fields.collectionEnds ? fields.collectionEnds[0] : null,
                otherLocations: fields.otherLocations ? fields.otherLocations[0] : null,
                summary: fields.summary ? fields.summary[0] : null,
                createdBy: fields.createdBy ? fields.createdBy[0] : null,
                showInUpcoming: fields.showInUpcoming ? fields.showInUpcoming[0] : null,
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

            if (mainImage !== null) {
                if (mainImage.mimetype !== 'image/jpeg' && mainImage.mimetype !== 'image/png' && mainImage.mimetype !== 'image/jpg') {
                    res.status(400).json({ message: `Invalid file type: ${mainImage.mimetype}. Only JPEG, JPG and PNG files are allowed.` });
                    return;
                }

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
                const project = await Project.create({
                    projectName: data.projectName,
                    summary: data.summary,
                    returnRangeMin: data.investment && data.investment.minimumReturn,
                    returnRangeMax: data.investment && data.investment.maximumReturn,
                    investmentType: data.investment && data.investment.investmentType,
                    returnType: data.investment && data.investment.returnType,
                    duration: data.investment && data.investment.duration,
                    tenure: data.investment && data.investment.tenure,
                    location: data.location,
                    unitInvestmentValue: data.unitInvestmentValue,
                    createdBy: data.createdBy,
                    totalReturnMin: data.totalReturnMin,
                    totalReturnMax: data.totalReturnMax,
                    collectionStarts: data.collectionStarts,
                    collectionEnds: data.collectionEnds,
                    otherLocations: data.otherLocations,
                    projectStatus: 'created',
                    showInUpcoming: data.showInUpcoming
                }, { transaction });

                if (mainImage !== null) {
                    let mainImageFileName = generateHash(Date.now() + mainImage.originalFilename!.toString()) + '.' + mainImage.originalFilename!.split('.').pop();
                    await File.create({
                        originalFileName: mainImage.originalFilename!,
                        fileName: mainImageFileName,
                        refType: 'project-main-image',
                        refId: project.idProjects
                    }, { transaction });

                    let [err1] = await _(s3.upload({ ...params, ContentType: mainImage.mimetype!, Body: fs.createReadStream(mainImage.filepath), Key: 'project-main-image/' + project.idProjects + '/' + mainImageFileName }).promise());
                    if (err1) {
                        await transaction.rollback();
                        return res.status(500).json({ success: false, message: err1.message });
                    }
                }

                if (featuredImages.length > 0) {
                    for (const file of featuredImages) {
                        let featuredImageFileName = generateHash(Date.now() + file.originalFilename!.toString()) + '.' + file.originalFilename!.split('.').pop();
                        await File.create({
                            originalFileName: file.originalFilename!,
                            fileName: featuredImageFileName,
                            refType: 'project-featured-image',
                            refId: project.idProjects
                        }, { transaction });

                        let [err2] = await _(s3.upload({ ...params, ContentType: file.mimetype!, Body: fs.createReadStream(file.filepath), Key: 'project-featured-image/' + project.idProjects + '/' + featuredImageFileName }).promise());
                        if (err2) {
                            await transaction.rollback();
                            return res.status(500).json({ success: false, message: err2.message });
                        }
                    }
                }

                await transaction.commit();
                return res.status(200).json({ success: true, message: 'Project created successfully', data: project });
            } catch (err) {
                await transaction.rollback();
                return res.status(500).json({ success: false, message: (err as Error).message });
            }
        });
    } else {
        res.status(405).json({ success: false, message: 'Method not allowed' });
    }
}
