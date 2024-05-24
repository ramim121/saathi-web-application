import { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import JWTPayload from '@/types/JWTPayload';
import { JWT_SECRET, S3_BUCKET_ACCESS_KEY, S3_BUCKET_SECRET_KEY, S3_BUCKET_REGION, S3_BUCKET_NAME } from '@/config/constants';
import { generateHash } from '@/utils/GenerateHash';
import * as formidable from 'formidable';
import _ from 'await-to-js';
import User from '@/models/User';
import logResponse from '@/utils/log';
import AWS, { S3 } from 'aws-sdk';
import fs from 'fs';
import path from 'path';


// Configure AWS SDK with your credentials and region
AWS.config.update({
    accessKeyId: S3_BUCKET_ACCESS_KEY,
    secretAccessKey: S3_BUCKET_SECRET_KEY,
    region: S3_BUCKET_REGION,
});

// Create an S3 instance
const s3 = new AWS.S3();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    logResponse(res);
    let tokenData = req.headers.authorization;
    let token = tokenData?.split(' ')[1];
    if (!token || jwt.verify(token, JWT_SECRET) === null) { res.status(401).json({ message: 'Invalid token' }); return; }

    const userInfo = jwt.decode(token) as JWTPayload;
    const user = await User.findByPk(userInfo.idUsers);

    if (!user) { res.status(400).json({ message: 'User not found' }); return; }


    const form = new formidable.IncomingForm({ maxFileSize: 2 * 1024 * 1024 });

    form.parse(req, async (error, fields, files) => {
        if (error) { res.status(500).json({ message: error.message }); return; }

        if (!files['nidfront']) { return res.status(400).json({ message: 'NID front image is required' }); }
        if (!files['nidback']) { return res.status(400).json({ message: 'NID back image is required' }); }

        const nidFrontFile = files['nidfront']![0] as formidable.File;
        const nidBackFile = files['nidback']![0] as formidable.File;

        if (nidFrontFile.mimetype !== 'image/jpeg' && nidFrontFile.mimetype !== 'image/png') {
            res.status(400).json({ message: `Invalid file type: ${nidFrontFile.mimetype}. Only JPEG and PNG files are allowed.` });
            return;
        }

        if (nidBackFile.mimetype !== 'image/jpeg' && nidBackFile.mimetype !== 'image/png') {
            res.status(400).json({ message: `Invalid file type: ${nidBackFile.mimetype}. Only JPEG and PNG files are allowed.` });
            return;
        }

        if (!nidFrontFile) { return res.status(400).json({ message: 'NID front image is required' }); return; }
        if (!nidBackFile) { return res.status(400).json({ message: 'NID back image is required' }); return; }

        let nidFrontfileName = generateHash(Date.now() + user.email.toString() + nidFrontFile.originalFilename!.toString()) + '.' + nidFrontFile.originalFilename!.split('.').pop();
        let nidBackfileName = generateHash(Date.now() + user.email.toString() + nidBackFile.originalFilename!.toString()) + '.' + nidBackFile.originalFilename!.split('.').pop();

        const params = {
            Bucket: S3_BUCKET_NAME,
            ACL: 'public-read'
        };

        let [err1, result1] = await _(s3.upload({ ...params, ContentType: nidFrontFile.mimetype!, Body: fs.createReadStream(nidFrontFile.filepath), Key: 'nid/' + nidFrontfileName }).promise());
        if (err1) { return res.status(500).json({ message: err1.message }); }
        console.log(result1);

        let [err2, result2] = await _(s3.upload({ ...params, ContentType: nidFrontFile.mimetype!, Body: fs.createReadStream(nidBackFile.filepath), Key: 'nid/' + nidBackfileName }).promise());
        if (err2) { return res.status(500).json({ message: err2.message }); }
        console.log(result2);

        user.nidImageFront = nidFrontfileName;
        user.nidImageBack = nidBackfileName;

        let [err] = await _(user.save());
        if (err) { return res.status(500).json({ message: err.message }); }

        return res.status(200).json({ message: 'NID updated successfully', user });
    })
}

export const config = {
    api: {
        bodyParser: false, // Disable body parsing, as we will handle it with Formidable
    },
};