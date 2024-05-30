import { NextApiRequest, NextApiResponse } from 'next';
import { User, File } from '@/models/__associations';
import Joi from 'joi';
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'POST') {

        const form = new formidable.IncomingForm();
        form.parse(req, async (err, fields, files) => {
            if (err) {
                return res.status(500).json({ message: err.message });
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
                }
                )
            }
            const params = {
                Bucket: S3_BUCKET_NAME,
                ACL: 'public-read'
            };

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
                })
                if (profilePicture !== null) {
                    let profilePicFileName = generateHash(Date.now() + profilePicture.originalFilename!.toString()) + '.' + profilePicture.originalFilename!.split('.').pop();
                    await File.create({
                        originalFileName: profilePicture.originalFilename!,
                        fileName: profilePicFileName,
                        refType: 'profile-picture',
                        refId: partner.idUsers
                    });
                    let [err1] = await _(s3.upload({ ...params, ContentType: profilePicture.mimetype!, Body: fs.createReadStream(profilePicture.filepath), Key: 'profile-picture/' + partner.idUsers + '/' + profilePicFileName }).promise());
                    if (err1) { return res.status(500).json({ message: err1.message }); }
                }

                if (featuredImages.length > 0) {
                    featuredImages.forEach(async (file: formidable.File) => {
                        let featuredImageFileName = generateHash(Date.now() + file.originalFilename!.toString()) + '.' + file.originalFilename!.split('.').pop();
                        await File.create({
                            originalFileName: file.originalFilename!,
                            fileName: featuredImageFileName,
                            refType: 'featured-image',
                            refId: partner.idUsers
                        });
                        let [err2] = await _(s3.upload({ ...params, ContentType: file.mimetype!, Body: fs.createReadStream(file.filepath), Key: 'featured-image/' + partner.idUsers + '/' + featuredImageFileName }).promise());
                        if (err2) { return res.status(500).json({ message: err2.message }); }
                    });
                }

                return res.status(200).json({ partner })
            } catch (err) {
                return res.status(500).json({ message: (err as Error).message })
            }
        });
    } else {
        res.status(405).json({ message: 'Method not allowed' })
    }
}
