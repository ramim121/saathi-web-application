import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '@/config/constants';
import type JWTPayload from '@/types/JWTPayload';
import { loadReports, safeDate, defaultRange, toCsv } from '@/utils/reports';

/**
 * CSV export for the reports page.
 *
 * ADMIN ONLY. The register carries investor names and phone numbers, so this
 * route repeats the page's auth check rather than assuming the caller arrived
 * from a page that already made it — a download URL gets copied, pasted into
 * chat, and opened by whoever has it.
 */

const REPORTS = {
    register: {
        headers: [
            'reference',
            'investor',
            'phone',
            'project',
            'investmentType',
            'units',
            'unitValue',
            'capital',
            'source',
            'status',
            'placedOn',
            'maturesOn',
        ],
    },
    schedule: {
        headers: [
            'month',
            'positions',
            'capital',
            'minProfit',
            'maxProfit',
            'minPayable',
            'maxPayable',
        ],
    },
    collections: { headers: ['method', 'bookings', 'amount'] },
} as const;

type ReportName = keyof typeof REPORTS;

function isAdmin(req: NextApiRequest): boolean {
    const token = req.cookies?.['saathi-token'];
    if (!token) return false;
    try {
        const payload = jwt.verify(token, JWT_SECRET) as JWTPayload;
        return String(payload?.userType ?? '') === 'admin';
    } catch {
        return false;
    }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ message: 'Method not allowed' });
    }

    if (!isAdmin(req)) return res.status(401).json({ message: 'Unauthorised' });

    const name = String(req.query.report ?? '') as ReportName;
    if (!Object.prototype.hasOwnProperty.call(REPORTS, name)) {
        return res.status(400).json({ message: 'Unknown report' });
    }

    const fallback = defaultRange();
    const range = {
        from: safeDate(req.query.from, fallback.from),
        to: safeDate(req.query.to, fallback.to),
    };

    try {
        const reports = await loadReports(range);
        const rows = reports[name] as unknown as Array<Record<string, unknown>>;
        const csv = toCsv(rows, [...REPORTS[name].headers]);

        /*
         * A BOM so Excel opens it as UTF-8. Without it, Bangla names and the
         * BDT sign arrive as mojibake on a Windows default install — which
         * looks like corrupt data rather than a text-encoding default.
         */
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader(
            'Content-Disposition',
            `attachment; filename="shathi-${name}-${range.from}-to-${range.to}.csv"`,
        );
        res.setHeader('Cache-Control', 'no-store');
        return res.status(200).send(`﻿${csv}`);
    } catch (error) {
        return res.status(500).json({ message: (error as Error).message });
    }
}
