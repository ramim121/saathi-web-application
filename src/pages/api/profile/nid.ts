import { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import JWTPayload from '@/types/JWTPayload';
import { JWT_SECRET, S3_BUCKET_ACCESS_KEY, S3_BUCKET_SECRET_KEY, S3_BUCKET_REGION, S3_BUCKET_NAME } from '@/config/constants';
import { generateHash } from '@/utils/GenerateHash';
import * as formidable from 'formidable';
import _ from 'await-to-js';
import User from '@/models/User';
import logResponse from '@/utils/log';
import fs from 'fs';
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

async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'OPTIONS') { return res.status(200).end(); }

    logResponse(res);
    let tokenData = req.headers.authorization;
    let token = tokenData?.split(' ')[1];
    if (!token || jwt.verify(token, JWT_SECRET) === null) { res.status(401).json({ success: false, message: 'Invalid token' }); return; }

    const userInfo = jwt.decode(token) as JWTPayload;
    const user = await User.findByPk(userInfo.idUsers);

    if (!user) { res.status(400).json({ success: false, message: 'User not found' }); return; }


    const form = new formidable.IncomingForm({ maxFileSize: 30 * 1024 * 1024 });

    form.parse(req, async (error, fields, files) => {
        if (error) { res.status(413).json({ success: false, message: error.message }); return; }

        if (!files['nidfront']) { return res.status(400).json({ success: false, message: 'NID front image is required' }); }
        if (!files['nidback']) { return res.status(400).json({ success: false, message: 'NID back image is required' }); }

        const nidFrontFile = files['nidfront']![0] as formidable.File;
        const nidBackFile = files['nidback']![0] as formidable.File;

        if (nidFrontFile.mimetype !== 'image/jpeg' && nidFrontFile.mimetype !== 'image/png') {
            res.status(400).json({ success: false, message: `Invalid file type: ${nidFrontFile.mimetype}. Only JPEG and PNG files are allowed.` });
            return;
        }

        if (nidBackFile.mimetype !== 'image/jpeg' && nidBackFile.mimetype !== 'image/png') {
            res.status(400).json({ success: false, message: `Invalid file type: ${nidBackFile.mimetype}. Only JPEG and PNG files are allowed.` });
            return;
        }

        if (!nidFrontFile) { return res.status(400).json({ success: false, message: 'NID front image is required' }); return; }
        if (!nidBackFile) { return res.status(400).json({ success: false, message: 'NID back image is required' }); return; }

        let nidFrontfileName = generateHash(Date.now() + user.idUsers!.toString() + nidFrontFile.originalFilename!.toString()) + '.' + nidFrontFile.originalFilename!.split('.').pop();
        let nidBackfileName = generateHash(Date.now() + user.idUsers!.toString() + nidBackFile.originalFilename!.toString()) + '.' + nidBackFile.originalFilename!.split('.').pop();

        const frontParams: any = {
            Bucket: S3_BUCKET_NAME,
            ACL: 'public-read',
            ContentType: nidFrontFile.mimetype!,
            Body: fs.createReadStream(nidFrontFile.filepath),
            Key: 'nid/' + nidFrontfileName
        };

        const backParams: any = {
            Bucket: S3_BUCKET_NAME,
            ACL: 'public-read',
            ContentType: nidBackFile.mimetype!,
            Body: fs.createReadStream(nidBackFile.filepath),
            Key: 'nid/' + nidBackfileName
        };

        let upload = new Upload({
            client: s3Client,
            params: frontParams
        });

        upload.on('httpUploadProgress', (progress: any) => {
            console.log(`Uploaded ${progress.loaded} of ${progress.total} bytes`);
        });
        let [err1, result1] = await _(upload.done());
        if (err1) { return res.status(400).json({ success: false, message: err1.message }); }

        upload = new Upload({
            client: s3Client,
            params: backParams
        });

        upload.on('httpUploadProgress', (progress: any) => {
            console.log(`Uploaded ${progress.loaded} of ${progress.total} bytes`);
        });

        let [err2, result2] = await _(upload.done());
        if (err2) { return res.status(400).json({ success: false, message: err2.message }); }
        console.log(result2);

        user.nidImageFront = nidFrontfileName;
        user.nidImageBack = nidBackfileName;
        user.nidVerificationStatus = 'pending';

        let [err] = await _(user.save());
        if (err) { return res.status(400).json({ success: false, message: err.message }); }

        return res.status(200).json({ success: true, message: 'NID updated successfully', data: user });
    })
}

export const config = {
    api: {
        bodyParser: false,
    },
};

export default cors(handler as any);
