import type { NextApiRequest, NextApiResponse } from 'next';
import { InvestorBalanceEntry, ProjectInvestmentBooking, User } from '@/models/__associations';
import { requireAdmin, withCors } from '@/utils/auth';

/** GET: an investor's balance (money held for them) and its entries, newest first. Admins only. */
async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') return res.status(405).json({ success: false, message: 'Method not allowed' });
    const idUsers = Number(req.query.id);
    if (!Number.isInteger(idUsers) || idUsers <= 0) return res.status(400).json({ success: false, message: 'Invalid investor' });
    try {
        const rows = await InvestorBalanceEntry.findAll({
            where: { idUsers },
            order: [['idInvestorBalanceEntries', 'DESC']],
            include: [{ model: User, as: 'CreatedBy', attributes: ['fullName'] }],
        });
        const bookingIds = Array.from(new Set(rows.map((r) => r.idProjectInvestmentBookings).filter(Boolean))) as number[];
        const bookings = bookingIds.length
            ? await ProjectInvestmentBooking.findAll({ where: { idProjectInvestmentBookings: bookingIds }, attributes: ['idProjectInvestmentBookings', 'bookingId'] })
            : [];
        const refOf = new Map(bookings.map((b) => [b.idProjectInvestmentBookings, b.bookingId]));
        const entries = rows.map((r) => ({
            id: r.idInvestorBalanceEntries,
            amount: Number(r.amount),
            entryType: r.entryType,
            note: r.note,
            idProjectInvestmentBookings: r.idProjectInvestmentBookings,
            bookingRef: r.idProjectInvestmentBookings ? refOf.get(r.idProjectInvestmentBookings) ?? null : null,
            reversesId: r.reversesId,
            createdBy: (r as any).CreatedBy?.fullName ?? null,
            createdAt: r.createdAt,
        }));
        const balance = Math.round(entries.reduce((s, e) => s + e.amount, 0) * 100) / 100;
        return res.status(200).json({ success: true, data: { balance, entries } });
    } catch (error) {
        return res.status(400).json({ success: false, message: (error as Error).message });
    }
}

export default withCors(requireAdmin(handler));
