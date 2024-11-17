import { NextApiRequest, NextApiResponse } from 'next';
import { User, File } from '@/models/__associations';
import Joi from 'joi';
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

const schema = Joi.object({
    name: Joi.string().required().messages({
        "any.required": "Name is required",
        "string.empty": "Name can not be empty",
    }),
    phoneNumber: Joi.string().required().messages({
        "any.required": "Phone number is required",
        "string.empty": "Phone number can not be empty",
    }),
    age: Joi.number().min(1).required().messages({
        "any.required": "Age is required",
        "number.base": "Age must be a number",
        "number.min": "Age must be greater than 0",
    }),
    location: Joi.string().required().messages({
        "any.required": "Location is required",
        "string.empty": "Location can not be empty",
    }),
    role: Joi.string().required().messages({
        "any.required": "Role is required",
        "string.empty": "Role can not be empty",
    }),
    joiningDate: Joi.date().required().messages({
        "any.required": "Joining date is required",
        "date.base": "Joining date must be selected",
    }),
    skills: Joi.string().required().messages({
        "any.required": "Skills is required",
        "string.empty": "At least one skill is required",
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

            const profilePicture = files['profilePicture'] ? files['profilePicture'][0] as formidable.File : null;
            const featuredImages = files['featuredImages'] ? files['featuredImages'] as formidable.File[] : [];
            const data = {
                name: fields.name ? fields.name[0] : null,
                phoneNumber: fields.phoneNumber ? fields.phoneNumber[0] : null,
                age: fields.age ? parseInt(fields.age[0]) : null,
                location: fields.location ? fields.location[0] : null,
                role: fields.role ? fields.role[0] : null,
                bio: fields.bio ? fields.bio[0] : null,
                interestedIn: fields.interestedIn ? fields.interestedIn[0] : null,
                joiningDate: fields.joiningDate ? new Date(fields.joiningDate[0]) : null,
                skills: fields.skills ? fields.skills[0] : null,
                education: fields.education ? fields.education[0] : null,
                disability: fields.disability ? fields.disability[0] : null,
                partnerType: fields.partnerType ? fields.partnerType[0] : null
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

            const existingUser = await User.findOne({ where: { phoneNumber: data.phoneNumber } });
            if (existingUser) {
                return res.status(400).json({ success: false, message: 'Partner with this phone number already exists' });
            }

            if (profilePicture !== null) {
                if (profilePicture.mimetype !== 'image/jpeg' && profilePicture.mimetype !== 'image/png' && profilePicture.mimetype !== 'image/jpg') {
                    res.status(400).json({ message: `Invalid file type: ${profilePicture.mimetype}. Only JPEG, JPG and PNG files are allowed.` });
                    return;
                }
            }

            if (featuredImages.length > 0) {
                featuredImages.forEach((file: formidable.File) => {
                    if (file.mimetype !== 'image/jpeg' && file.mimetype !== 'image/png' && file.mimetype !== 'image/jpg') {
                        res.status(400).json({ message: `Invalid file type: ${file.mimetype}. Only JPEG, JPG and PNG files are allowed.` });
                        return;
                    }
                });
            }

            const params = {
                Bucket: S3_BUCKET_NAME,
                ACL: 'public-read'
            };

            const transaction = await sequelize.transaction();

            try {
                const partner = await User.create({
                    fullName: data.name,
                    phoneNumber: data.phoneNumber,
                    age: data.age,
                    location: data.location,
                    role: data.role,
                    bio: data.bio,
                    interestedIn: data.interestedIn,
                    joiningDate: data.joiningDate,
                    skills: data.skills,
                    userType: 'partner',
                    education: data.education,
                    disability: data.disability,
                    partnerType: data.partnerType
                }, { transaction });

                if (profilePicture !== null) {
                    const profilePicFileName = generateHash(Date.now() + profilePicture.originalFilename!.toString()) + '.' + profilePicture.originalFilename!.split('.').pop();
                    const profilePicThumbFileName = generateHash(Date.now() + profilePicture.originalFilename!.toString()) + '-thumb.' + profilePicture.originalFilename!.split('.').pop();
                    const profilePicThumbPath = path.join(os.tmpdir(), profilePicThumbFileName);

                    await sharp(profilePicture.filepath)
                        .resize(400, 400, {
                            fit: 'inside'
                        })
                        .toFile(profilePicThumbPath)
                        .catch(err => console.log('Thumbnail generation error:', err));

                    const upload = new Upload({
                        client: s3Client,
                        params: { ...params, ContentType: profilePicture.mimetype!, Body: fs.createReadStream(profilePicture.filepath), Key: 'profile-picture/' + partner.idUsers + '/' + profilePicFileName } as any
                    });

                    const thumbUpload = new Upload({
                        client: s3Client,
                        params: { ...params, ContentType: profilePicture.mimetype!, Body: fs.createReadStream(profilePicThumbPath), Key: 'profile-picture/' + partner.idUsers + '/' + profilePicThumbFileName } as any
                    });

                    upload.on('httpUploadProgress', (progress: any) => {
                        console.log(`Uploaded ${progress.loaded} of ${progress.total} bytes`);
                    });
                    let [err1] = await _(upload.done());
                    if (err1) {
                        await transaction.rollback();
                        return res.status(500).json({ success: false, message: "profile picture upload error. " + err1.message });
                    }

                    thumbUpload.on('httpUploadProgress', (progress: any) => {
                        console.log(`Uploaded ${progress.loaded} of ${progress.total} bytes`);
                    });
                    let [err2, result2] = await _(thumbUpload.done());

                    if (err2) {
                        await transaction.rollback();
                        return res.status(500).json({ success: false, message: err2.message });
                    }

                    await File.create({
                        originalFileName: profilePicture.originalFilename!,
                        fileName: profilePicFileName,
                        thumbnail: profilePicThumbFileName,
                        refType: 'profile-picture',
                        refId: partner.idUsers
                    }, { transaction });
                }

                if (featuredImages.length > 0) {
                    for (const file of featuredImages) {
                        const featuredImageFileName = generateHash(Date.now() + file.originalFilename!.toString()) + '.' + file.originalFilename!.split('.').pop();
                        const featuredImageThumbFileName = generateHash(Date.now() + file.originalFilename!.toString()) + '-thumb.' + file.originalFilename!.split('.').pop();
                        const featuredImageThumbPath = path.join(os.tmpdir(), featuredImageThumbFileName);

                        await sharp(file.filepath)
                            .resize(400, 400, {
                                fit: 'inside'
                            })
                            .toFile(featuredImageThumbPath)
                            .catch(err => console.log('Thumbnail generation error:', err));

                        const upload = new Upload({
                            client: s3Client,
                            params: { ...params, ContentType: file.mimetype!, Body: fs.createReadStream(file.filepath), Key: 'featured-image/' + partner.idUsers + '/' + featuredImageFileName } as any
                        });

                        const thumbUpload = new Upload({
                            client: s3Client,
                            params: { ...params, ContentType: file.mimetype!, Body: fs.createReadStream(featuredImageThumbPath), Key: 'featured-image/' + partner.idUsers + '/' + featuredImageThumbFileName } as any
                        });

                        upload.on('httpUploadProgress', (progress: any) => {
                            console.log(`Uploaded ${progress.loaded} of ${progress.total} bytes`);
                        });

                        let [err2] = await _(upload.done());
                        if (err2) {
                            await transaction.rollback();
                            return res.status(500).json({ success: false, message: "Featured image upload error. " + err2.message });
                        }

                        thumbUpload.on('httpUploadProgress', (progress: any) => {
                            console.log(`Uploaded ${progress.loaded} of ${progress.total} bytes`);
                        });

                        let [err3] = await _(thumbUpload.done());
                        if (err3) {
                            await transaction.rollback();
                            return res.status(500).json({ success: false, message: "Featured image thumbnail upload error. " + err3.message });
                        }

                        await File.create({
                            originalFileName: file.originalFilename!,
                            fileName: featuredImageFileName,
                            thumbnail: featuredImageThumbFileName,
                            refType: 'featured-image',
                            refId: partner.idUsers
                        }, { transaction });
                    }
                }

                await transaction.commit();
                return res.status(200).json({ success: true, message: 'Partner registered successfully', data: partner });
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