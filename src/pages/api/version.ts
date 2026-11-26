import { NextApiRequest, NextApiResponse } from 'next';
import AppVersion from '@/models/AppVersion';

/**
 * Latest store version per platform (app_versions), plus the minimum
 * version still supported, from APP_MIN_VERSION_ANDROID / APP_MIN_VERSION_IOS
 * in .env (optional; unset means no minimum). The app asks once per new
 * version; a build older than the minimum must update and cannot dismiss it.
 * Read directly from process.env, not config/constants, because they are
 * optional and constants.ts throws on a missing variable.
 */
const minVersion = (v: string | undefined) => (v && /^\d+(\.\d+)*$/.test(v.trim()) ? v.trim() : null);

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

        return res.status(200).json({
            latestIosVersion,
            latestAndroidVersion,
            minAndroidVersion: minVersion(process.env.APP_MIN_VERSION_ANDROID),
            minIosVersion: minVersion(process.env.APP_MIN_VERSION_IOS),
        });
    }
    else {
        res.status(405).json({ success: false, message: 'Method not allowed' });
    }
}