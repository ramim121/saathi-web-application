import type { NextApiRequest, NextApiResponse } from 'next';
import { withCors, requireAdmin } from '@/utils/auth';
import { loadInvestorDetail } from '@/utils/investorReport';

/**
 * GET /api/reports/investors/{id} — one investor's figures and every booking.
 * Admin only.
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, message: 'Method not allowed' });
    }
    const id = Number(req.query.id);
    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid investor id' });
    }
    try {
        const data = await loadInvestorDetail(id);
        if (!data) return res.status(404).json({ success: false, message: 'Investor not found' });
        res.setHeader('Cache-Control', 'no-store');
        return res.status(200).json({ success: true, data });
    } catch (error) {
        return res.status(500).json({ success: false, message: (error as Error).message });
    }
}

export default withCors(requireAdmin(handler));
