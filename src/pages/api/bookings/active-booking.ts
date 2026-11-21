import { NextApiRequest, NextApiResponse } from 'next';
import { Op } from 'sequelize';
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
import { searchTerm } from '@/utils/listSearch';

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

/** Lines that have matured and wait for a payout or a reinvestment. */
const WAITING = ['ready_for_withdrawal', 'request_withdrawal'];
const STAGES = ['', 'running', 'due30', 'matured'] as const;
type Stage = (typeof STAGES)[number];

/**
 * Investments with money working (confirmed lines), soonest to mature first.
 *
 * Query: q (booking ref, investor name or phone, project), stage
 * (running | due30 | matured — matured also takes in lines marked ready for
 * withdrawal), idProjects, orderBy (maturity | amount | investor | project |
 * booking | start), orderType, page, pageSize. The response carries the count
 * of each stage for the tabs, and the projects present for the filter.
 *
 * Everything is worked out in memory, as before: maturity depends on the
 * project's term, which SQL here does not know.
 */
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
    const limit = Math.min(Math.max(parseInt(pageSize as string) || 10, 1), 200);
    const pageNo = Math.max(parseInt(page as string) || 1, 1);
    const offset = (pageNo - 1) * limit;
    const stage: Stage = STAGES.includes(req.query.stage as Stage) ? (req.query.stage as Stage) : '';
    const idProjects = Number(req.query.idProjects) || null;
    const term = searchTerm(req.query.q)?.toLowerCase().replace(/^#/, '') ?? null;
    const orderBy = String(req.query.orderBy || 'maturity');
    const direction = String(req.query.orderType || 'ASC').toUpperCase() === 'DESC' ? -1 : 1;

    try {
        const result = await ProjectInvestor.findAll({
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
            where: { investmentStatus: { [Op.in]: ['confirmed', ...WAITING] } },
        });

        const today = new Date();
        const rows = result.map(row => {
            const data = row.toJSON() as any;

            const unitPurchased = Number(data.unitPurchased || 0);
            const unitPrice = Number(data.Project?.unitInvestmentValue || 0);
            const returnMin = Number(data.Project?.returnRangeMin || 0);
            const returnMax = Number(data.Project?.returnRangeMax || 0);
            // The capital is what was recorded with the partners (as the investor
            // report and reinvestment use); units x unit price if nothing was.
            const recorded = (data.ProjectPartnerInvestors || []).reduce((s: number, a: any) => s + Number(a.amountInvested || 0), 0);
            const principal = recorded > 0 ? recorded : unitPurchased * unitPrice;
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

            let remainingDays: number | null = null;
            let remainingTimeFormatted = "-";
            if (maturityDate !== "-") {
                const maturity = new Date(maturityDate);
                const diffTime = maturity.getTime() - today.getTime();
                remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                remainingTimeFormatted = remainingDays >= 0
                    ? formatRemainingDays(remainingDays)
                    : "Matured";
            }

            const waiting = WAITING.includes(data.investmentStatus);
            const matured = waiting || (remainingDays !== null && remainingDays <= 0);

            return {
                ...data,
                capital: principal,
                totalReturnMin: minReturn,
                totalReturnMax: maxReturn,
                totalReturnRange: `${minReturn.toFixed(2)} - ${maxReturn.toFixed(2)}`,
                maturityDate,
                remainingDays,
                remainingTimeFormatted: waiting ? 'Matured' : remainingTimeFormatted,
                matured,
                waiting,
            };
        });

        const confirmed = rows.filter((r) => !r.waiting);
        const inStage = (r: (typeof rows)[number], s: Stage) =>
            s === 'matured' ? r.matured
                : s === 'due30' ? !r.waiting && !r.matured && r.remainingDays !== null && r.remainingDays <= 30
                    : s === 'running' ? !r.waiting && !r.matured
                        : !r.waiting;
        const counts = {
            all: confirmed.length,
            running: rows.filter((r) => inStage(r, 'running')).length,
            due30: rows.filter((r) => inStage(r, 'due30')).length,
            matured: rows.filter((r) => inStage(r, 'matured')).length,
        };

        const projectMap = new Map<number, string>();
        for (const r of rows) if (r.Project?.idProjects) projectMap.set(r.Project.idProjects, r.Project.projectName);
        const projects = Array.from(projectMap.entries()).map(([id, name]) => ({ idProjects: id, projectName: name })).sort((a, b) => a.projectName.localeCompare(b.projectName));

        let filtered = rows.filter((r) => inStage(r, stage));
        if (idProjects) filtered = filtered.filter((r) => r.Project?.idProjects === idProjects);
        if (term) {
            filtered = filtered.filter((r) => {
                const b = r.ProjectInvestmentBooking;
                return [b?.bookingId, String(r.idProjectInvestmentBookings), b?.User?.fullName, b?.User?.phoneNumber, b?.User?.email, r.Project?.projectName]
                    .some((v) => typeof v === 'string' && v.toLowerCase().includes(term));
            });
        }

        const key: Record<string, (r: (typeof rows)[number]) => string | number | null> = {
            maturity: (r) => r.remainingDays,
            amount: (r) => r.capital,
            investor: (r) => r.ProjectInvestmentBooking?.User?.fullName?.toLowerCase() ?? null,
            project: (r) => r.Project?.projectName?.toLowerCase() ?? null,
            booking: (r) => Number(r.ProjectInvestmentBooking?.bookingId) || r.idProjectInvestmentBookings,
            start: (r) => r.ProjectInvestmentBooking?.paymentDate ? new Date(r.ProjectInvestmentBooking.paymentDate).getTime() : null,
        };
        const pick = key[orderBy] ?? key.maturity;
        const sortedRows = filtered.sort((a, b) => {
            const x = pick(a);
            const y = pick(b);
            if (x === y) return 0;
            if (x === null) return 1;
            if (y === null) return -1;
            return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * direction;
        });

        const paginatedRows = sortedRows.slice(offset, offset + limit);

        res.status(200).json({
            success: true,
            data: paginatedRows,
            total: sortedRows.length,
            counts,
            projects,
            currentPage: pageNo,
            totalPages: Math.ceil(sortedRows.length / limit),
        });
    } catch (error) {
        res.status(400).json({ success: false, message: (error as Error).message });
    }
}

export default cors(handler as any);
