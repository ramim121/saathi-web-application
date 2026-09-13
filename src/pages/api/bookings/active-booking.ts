import { NextApiRequest, NextApiResponse } from 'next';
import {
    ProjectInvestor,
    Project,
    ProjectPartnerInvestor,
    User,
    ProjectPartner,
    ProjectInvestmentBooking
} from '@/models/__associations';
import Cors from 'micro-cors';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '@/config/constants';
import JWTPayload from '@/types/JWTPayload';

const cors = Cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS', 'PUT'],
    allowHeaders: ['X-Requested-With', 'Authorization', 'Content-Type'],
});

function formatRemainingDays(diffInDays: number): string {
    const years = Math.floor(diffInDays / 365);
    const months = Math.floor((diffInDays % 365) / 30);
    const days = diffInDays % 30;

    const parts: string[] = [];
    if (years > 0) parts.push(`${years} year${years > 1 ? 's' : ''}`);
    if (months > 0) parts.push(`${months} month${months > 1 ? 's' : ''}`);
    if (days > 0) parts.push(`${days} day${days > 1 ? 's' : ''}`);

    return parts.length ? parts.join(', ') : "0 days";
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ success: false, message: 'Method not allowed' });

    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'Token missing' });

    let userInfo: JWTPayload;
    try {
        userInfo = jwt.verify(token, JWT_SECRET) as JWTPayload;
    } catch {
        return res.status(401).json({ success: false, message: 'Invalid token' });
    }

    if (userInfo.userType !== 'admin') {
        return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { page = "1", pageSize = "10" } = req.query;
    const limit = parseInt(pageSize as string);
    const offset = (parseInt(page as string) - 1) * limit;

    try {
        const result = await ProjectInvestor.findAndCountAll({
            include: [
                { model: Project },
                {
                    model: ProjectPartnerInvestor,
                    include: [{
                        model: ProjectPartner,
                        include: [{ model: User }]
                    }]
                },
                {
                    model: ProjectInvestmentBooking,
                    include: [{ model: User }]
                },
            ],
            where: { investmentStatus: 'confirmed' },
            distinct: true,
        });

        const enhancedRows = result.rows.map(row => {
            const data = row.toJSON();

            const unitPurchased = Number(data.unitPurchased || 0);
            const unitPrice = Number(data.Project?.unitInvestmentValue || 0);
            const returnMin = Number(data.Project?.returnRangeMin || 0);
            const returnMax = Number(data.Project?.returnRangeMax || 0);
            const principal = unitPurchased * unitPrice;
            const minReturn = principal + (principal * (returnMin / 100));
            const maxReturn = principal + (principal * (returnMax / 100));

            let maturityDate = "-";
            const paymentDate = data.ProjectInvestmentBooking?.paymentDate;
            const duration = Number(data.Project?.duration || 0);
            const tenure = data.Project?.tenure?.toLowerCase();

            if (paymentDate && duration && tenure) {
                const date = new Date(paymentDate);
                if (tenure === "months" || tenure === "month") date.setMonth(date.getMonth() + duration);
                else if (tenure === "years" || tenure === "year") date.setFullYear(date.getFullYear() + duration);
                else if (tenure === "days" || tenure === "day") date.setDate(date.getDate() + duration);
                maturityDate = date.toISOString().split("T")[0];
            }

            let remainingDays = null;
            let remainingTimeFormatted = "-";
            if (maturityDate !== "-") {
                const today = new Date();
                const maturity = new Date(maturityDate);
                const diffTime = maturity.getTime() - today.getTime();
                remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                remainingTimeFormatted = remainingDays >= 0
                    ? formatRemainingDays(remainingDays)
                    : "Matured";
            }

            return {
                ...data,
                totalReturnMin: minReturn,
                totalReturnMax: maxReturn,
                totalReturnRange: `${minReturn.toFixed(2)} - ${maxReturn.toFixed(2)}`,
                maturityDate,
                remainingDays,
                remainingTimeFormatted
            };
        });

        const sortedRows = enhancedRows.sort((a, b) => {
            if (a.remainingDays == null) return 1;
            if (b.remainingDays == null) return -1;
            return a.remainingDays - b.remainingDays;
        });

        const paginatedRows = sortedRows.slice(offset, offset + limit);

        res.status(200).json({
            success: true,
            data: paginatedRows,
            total: sortedRows.length,
            currentPage: parseInt(page as string),
            totalPages: Math.ceil(sortedRows.length / limit),
        });
    } catch (error) {
        res.status(400).json({ success: false, message: (error as Error).message });
    }
}

export default cors(handler as any);
