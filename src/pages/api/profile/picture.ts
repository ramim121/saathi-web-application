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
    console.log(req.headers);
    let token = tokenData?.split(' ')[1];
    if (!token || jwt.verify(token, JWT_SECRET) === null) { res.status(401).json({ success: false, message: 'Invalid token' }); return; }

    const userInfo = jwt.decode(token) as JWTPayload;
    const user = await User.findByPk(userInfo.idUsers);

    if (!user) { res.status(400).json({ success: false, message: 'User not found' }); return; }


    const form = new formidable.IncomingForm({ maxFileSize: 10 * 1024 * 1024 });

    form.parse(req, async (error, fields, files) => {
        if (error) { res.status(413).json({ message: error.message }); return; }

        if (!files['profile-picture']) { return res.status(400).json({ success: false, message: 'Profile picture is required' }); }

        const profilePicture = files['profile-picture']![0] as formidable.File;

        if (profilePicture.mimetype !== 'image/jpeg' && profilePicture.mimetype !== 'image/png') {
            res.status(400).json({ success: false, message: `Invalid file type: ${profilePicture.mimetype}. Only JPEG and PNG files are allowed.` });
            return;
        }

        if (!profilePicture) { return res.status(400).json({ success: false, message: 'Profile picture is required' }); }

        let profilePicturefileName = generateHash(Date.now() + user.idUsers!.toString() + profilePicture.originalFilename!.toString()) + '.' + profilePicture.originalFilename!.split('.').pop();

        const params: any = {
            Bucket: S3_BUCKET_NAME,
            ContentType: profilePicture.mimetype,
            ACL: 'public-read',
            Body: fs.createReadStream(profilePicture.filepath),
            Key: 'profile/' + profilePicturefileName
        };
        const upload = new Upload({
            client: s3Client,
            params: params
        });

        upload.on('httpUploadProgress', (progress: any) => {
            console.log(`Uploaded ${progress.loaded} of ${progress.total} bytes`);
        });
        let [err1, result1] = await _(upload.done());
        if (err1) { return res.status(400).json({ success: false, message: err1.message }); }
        console.log('File uploaded successfully', result1);

        user.profileImage = profilePicturefileName;

        let [err] = await _(user.save());
        if (err) { return res.status(400).json({ success: false, message: err.message }); }

        return res.status(200).json({ success: false, message: 'Profile picture updated successfully', data: user });
    })
}

export const config = {
    api: {
        bodyParser: false, // Disable body parsing, as we will handle it with Formidable
    },
};

export default cors(handler as any);