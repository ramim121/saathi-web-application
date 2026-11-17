import type { NextApiRequest, NextApiResponse } from 'next';
import { withCors, requireAdmin } from '@/utils/auth';
import { loadInvestorList } from '@/utils/investorReport';

/**
 * GET /api/reports/investors — every investor with their headline figures.
 * Admin only. The page renders this list on the server; this route is for
 * refreshing it without a reload. Figures: see utils/investorReport.ts.
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, message: 'Method not allowed' });
    }
    try {
        const data = await loadInvestorList();
        res.setHeader('Cache-Control', 'no-store');
        return res.status(200).json({ success: true, data });
    } catch (error) {
        return res.status(500).json({ success: false, message: (error as Error).message });
    }
}

export default withCors(requireAdmin(handler));
