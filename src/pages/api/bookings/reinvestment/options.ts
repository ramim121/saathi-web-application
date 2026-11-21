import type { NextApiRequest, NextApiResponse } from 'next';
import { requireAdmin, withCors } from '@/utils/auth';
import { balanceOf, loadReinvestSource, openProjects } from '@/utils/reinvestmentServer';

/**
 * GET ?idProjectInvestors=<matured line>: everything the reinvest dialog needs
 * (capital, profit, maturity, the investor's balance, projects open for money).
 * Admins only.
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') return res.status(405).json({ success: false, message: 'Method not allowed' });
    const id = Number(req.query.idProjectInvestors);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ success: false, message: 'Invalid investment line' });
    try {
        const source = await loadReinvestSource(id);
        if (!source) return res.status(404).json({ success: false, message: 'Investment not found' });
        const [balance, projects] = await Promise.all([balanceOf(source.line.idUsers), openProjects()]);
        const u = source.user as any;
        return res.status(200).json({
            success: true,
            data: {
                source: {
                    idProjectInvestors: source.line.idProjectInvestors,
                    idProjectInvestmentBookings: source.booking?.idProjectInvestmentBookings ?? null,
                    bookingRef: source.booking?.bookingId ?? null,
                    units: Number(source.line.unitPurchased),
                    capital: source.capital,
                    idProjectPartners: source.idProjectPartners,
                    status: source.status,
                    maturityDate: source.maturityDate,
                    profitRecorded: source.profitRecorded,
                    actualProfit: source.actualProfit,
                    actualProfitPercentage: source.actualProfitPercentage,
                    expectedProfit: source.expectedProfit,
                    eligible: source.eligible,
                    reason: source.reason,
                    project: {
                        idProjects: source.project?.idProjects,
                        projectName: source.project?.projectName,
                        unitInvestmentValue: Number(source.project?.unitInvestmentValue) || 0,
                        returnRangeMin: Number(source.project?.returnRangeMin) || 0,
                        returnRangeMax: Number(source.project?.returnRangeMax) || 0,
                    },
                    investor: {
                        idUsers: u?.idUsers,
                        fullName: u?.fullName,
                        phoneNumber: u?.phoneNumber,
                        email: u?.email,
                        // Where a notification can reach them (push needs the app and a working key).
                        channels: { sms: Boolean(u?.phoneNumber && u?.phoneVerified === 'yes'), email: Boolean(u?.email && u?.emailVerified === 'yes') },
                    },
                },
                balance,
                projects,
            },
        });
    } catch (error) {
        return res.status(400).json({ success: false, message: (error as Error).message });
    }
}

export default withCors(requireAdmin(handler));
