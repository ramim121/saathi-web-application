import { NextApiRequest, NextApiResponse } from 'next';
import AppVersion from '@/models/AppVersion';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {

    if (req.method === 'OPTIONS') { return res.status(200).end(); }
    if (req.method === 'GET') {

        let latestIosVersion = await AppVersion.findOne({
            order: [['idAppVersions', 'DESC']],
            where: { platform: 'ios' }
        });

        let latestAndroidVersion = await AppVersion.findOne({
            order: [['idAppVersions', 'DESC']],
            where: { platform: 'android' }
        });

        return res.status(200).json({ latestIosVersion, latestAndroidVersion });
    }
    else {
        res.status(405).json({ success: false, message: 'Method not allowed' });
    }
}