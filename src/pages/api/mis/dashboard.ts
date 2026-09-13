import { NextApiRequest, NextApiResponse } from 'next';
import sequelize from '@/config/db';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '@/config/constants';
import JWTPayload from '@/types/JWTPayload';
import { QueryTypes } from 'sequelize';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

    const tokenData = req.headers.authorization;
    const token = tokenData?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'Invalid token' });
    try { jwt.verify(token, JWT_SECRET); } catch { return res.status(401).json({ success: false, message: 'Invalid token' }); }
    const userInfo = jwt.decode(token) as JWTPayload;
    if (userInfo.userType !== 'admin') return res.status(403).json({ success: false, message: 'Access denied' });

    try {
        // Total active investment — only 'confirmed' (ready_for_withdrawal = already settled in practice)
        const [totalInvestmentRow] = await sequelize.query(`
            SELECT
                COALESCE(SUM(pib.payment_amount - COALESCE(pib.reinvested_amount, 0)), 0) AS totalFreshCapital,
                COALESCE(SUM(pib.payment_amount), 0) AS totalInvestment,
                COALESCE(SUM(COALESCE(pib.reinvested_amount, 0)), 0) AS totalReinvestedCapital
            FROM project_investment_bookings pib
            WHERE pib.payment_confirmation_status = 'confirmed'
              AND pib.cancelled = 'no'
              AND EXISTS (
                  SELECT 1 FROM project_investors pi
                  WHERE pi.id_project_investment_bookings = pib.id_project_investment_bookings
                    AND pi.investment_status = 'confirmed'
              )
        `, { type: QueryTypes.SELECT }) as any[];

        // Withdrawal queue — investments pending final settlement in system
        const [withdrawalQueueRow] = await sequelize.query(`
            SELECT
                COUNT(*) AS withdrawalQueueCount,
                COALESCE(SUM(pi.unit_purchased * p.unit_investment_value + COALESCE(pi.actual_profit_amount, 0)), 0) AS withdrawalQueueTotal
            FROM project_investors pi
            JOIN projects p ON p.id_projects = pi.id_projects
            WHERE pi.investment_status = 'ready_for_withdrawal'
        `, { type: QueryTypes.SELECT }) as any[];

        // Pending payment confirmations
        const [pendingPaymentRow] = await sequelize.query(`
            SELECT COUNT(*) AS pendingPaymentConfirmations
            FROM project_investment_bookings
            WHERE payment_confirmation_status IN ('pending', 'uploaded')
              AND cancelled = 'no'
        `, { type: QueryTypes.SELECT }) as any[];

        // Pending physical collections
        const [pendingCollectionsRow] = await sequelize.query(`
            SELECT COUNT(*) AS pendingCollections, COALESCE(SUM(payment_amount), 0) AS pendingCollectionsAmount
            FROM project_investment_bookings
            WHERE collection_required = 'yes'
              AND collection_status = 'pending'
              AND cancelled = 'no'
        `, { type: QueryTypes.SELECT }) as any[];

        // Total distinct active investors — confirmed only
        const [investorsRow] = await sequelize.query(`
            SELECT
                COUNT(DISTINCT pi.id_users) AS totalInvestors,
                COUNT(DISTINCT CASE WHEN pib.created_at >= DATE_FORMAT(NOW(), '%Y-%m-01') THEN pi.id_users END) AS newInvestorsThisMonth
            FROM project_investors pi
            JOIN project_investment_bookings pib ON pib.id_project_investment_bookings = pi.id_project_investment_bookings
            WHERE pi.investment_status = 'confirmed'
              AND pib.payment_confirmation_status = 'confirmed'
        `, { type: QueryTypes.SELECT }) as any[];

        // Investment by project — confirmed only
        const investmentByProject = await sequelize.query(`
            SELECT
                p.project_name AS projectName,
                p.investment_type AS investmentType,
                COUNT(pi.id_project_investors) AS investorCount,
                COALESCE(SUM(pi.unit_purchased), 0) AS totalUnits,
                COALESCE(SUM(pi.unit_purchased * p.unit_investment_value), 0) AS totalRaised
            FROM project_investors pi
            JOIN projects p ON p.id_projects = pi.id_projects
            WHERE pi.investment_status = 'confirmed'
            GROUP BY p.id_projects, p.project_name, p.investment_type
            ORDER BY totalRaised DESC
        `, { type: QueryTypes.SELECT });

        // Investment by type — confirmed only
        const investmentByType = await sequelize.query(`
            SELECT
                p.investment_type AS investmentType,
                COALESCE(SUM(pi.unit_purchased * p.unit_investment_value), 0) AS totalRaised,
                COUNT(pi.id_project_investors) AS investorCount
            FROM project_investors pi
            JOIN projects p ON p.id_projects = pi.id_projects
            WHERE pi.investment_status = 'confirmed'
            GROUP BY p.investment_type
        `, { type: QueryTypes.SELECT });

        // Payables forecast — confirmed only (ready_for_withdrawal already settled in practice)
        const MATURITY_CASE = `CASE
            WHEN p.tenure = 'months' THEN DATE_ADD(pi.investment_date, INTERVAL p.duration MONTH)
            WHEN p.tenure = 'years'  THEN DATE_ADD(pi.investment_date, INTERVAL p.duration YEAR)
        END`;

        const getPayables = async (days: number) => {
            const rows = await sequelize.query(`
                SELECT
                    COALESCE(SUM(COALESCE(pi.actual_profit_amount,
                        pi.unit_purchased * p.unit_investment_value * p.return_range_min / 100
                    )), 0) AS profitOnly,
                    COALESCE(SUM(
                        pi.unit_purchased * p.unit_investment_value +
                        COALESCE(pi.actual_profit_amount,
                            pi.unit_purchased * p.unit_investment_value * p.return_range_min / 100
                        )
                    ), 0) AS profitPlusCapital,
                    COUNT(*) AS count
                FROM project_investors pi
                JOIN projects p ON p.id_projects = pi.id_projects
                WHERE pi.investment_status = 'confirmed'
                  AND (${MATURITY_CASE}) BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL ${days} DAY)
            `, { type: QueryTypes.SELECT }) as any[];
            return rows[0];
        };

        // Payable breakdown detail (list of investments per window)
        const getPayableDetails = async (days: number) => {
            return sequelize.query(`
                SELECT
                    u.full_name AS investorName,
                    p.project_name AS projectName,
                    pi.unit_purchased AS units,
                    pi.unit_purchased * p.unit_investment_value AS capital,
                    COALESCE(pi.actual_profit_amount,
                        ROUND(pi.unit_purchased * p.unit_investment_value * p.return_range_min / 100, 2)
                    ) AS estimatedProfit,
                    pi.actual_profit_amount IS NOT NULL AS profitConfirmed,
                    pi.unit_purchased * p.unit_investment_value + COALESCE(pi.actual_profit_amount,
                        ROUND(pi.unit_purchased * p.unit_investment_value * p.return_range_min / 100, 2)
                    ) AS estimatedTotal,
                    (${MATURITY_CASE}) AS maturityDate,
                    pi.investment_date AS investmentDate,
                    pib.id_project_investment_bookings AS bookingId
                FROM project_investors pi
                JOIN projects p ON p.id_projects = pi.id_projects
                JOIN users u ON u.id_users = pi.id_users
                JOIN project_investment_bookings pib ON pib.id_project_investment_bookings = pi.id_project_investment_bookings
                WHERE pi.investment_status = 'confirmed'
                  AND (${MATURITY_CASE}) BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL ${days} DAY)
                ORDER BY maturityDate ASC
            `, { type: QueryTypes.SELECT });
        };

        const [p15, p30, p60, p90, pd15, pd30, pd60, pd90] = await Promise.all([
            getPayables(15),
            getPayables(30),
            getPayables(60),
            getPayables(90),
            getPayableDetails(15),
            getPayableDetails(30),
            getPayableDetails(60),
            getPayableDetails(90),
        ]);

        // Monthly trend (last 6 months — all confirmed bookings regardless of current status)
        const monthlyTrend = await sequelize.query(`
            SELECT
                DATE_FORMAT(pib.created_at, '%Y-%m') AS month,
                COUNT(DISTINCT pi.id_project_investors) AS newInvestments,
                COALESCE(SUM(pi.unit_purchased * p.unit_investment_value), 0) AS totalRaised
            FROM project_investors pi
            JOIN project_investment_bookings pib ON pib.id_project_investment_bookings = pi.id_project_investment_bookings
            JOIN projects p ON p.id_projects = pi.id_projects
            WHERE pib.payment_confirmation_status = 'confirmed'
              AND pib.created_at >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
            GROUP BY DATE_FORMAT(pib.created_at, '%Y-%m')
            ORDER BY month ASC
        `, { type: QueryTypes.SELECT });

        // Top 5 partners by investment volume — confirmed only
        const topPartners = await sequelize.query(`
            SELECT
                u.full_name AS partnerName,
                COUNT(ppi.id_project_partner_investors) AS investmentCount,
                COALESCE(SUM(ppi.amount_invested), 0) AS totalInvested
            FROM project_partner_investors ppi
            JOIN project_partners pp ON pp.id_project_partners = ppi.id_project_partners
            JOIN users u ON u.id_users = pp.id_users
            JOIN project_investors pi ON pi.id_project_investors = ppi.id_project_investors
            WHERE pi.investment_status = 'confirmed'
            GROUP BY pp.id_users, u.full_name
            ORDER BY totalInvested DESC
            LIMIT 5
        `, { type: QueryTypes.SELECT });

        // Breakdown: confirmed active investments
        const activeInvestmentDetails = await sequelize.query(`
            SELECT
                u.full_name AS investorName,
                p.project_name AS projectName,
                p.investment_type AS investmentType,
                pi.unit_purchased AS units,
                pi.unit_purchased * p.unit_investment_value AS capital,
                pi.investment_status AS status,
                COALESCE(pi.actual_profit_amount, 0) AS profit,
                pi.actual_profit_percentage AS profitPercent,
                pi.investment_date AS investmentDate,
                (${MATURITY_CASE}) AS maturityDate,
                pib.id_project_investment_bookings AS bookingId,
                COALESCE(pib.reinvested_amount, 0) AS reinvestedAmount
            FROM project_investors pi
            JOIN projects p ON p.id_projects = pi.id_projects
            JOIN users u ON u.id_users = pi.id_users
            JOIN project_investment_bookings pib ON pib.id_project_investment_bookings = pi.id_project_investment_bookings
            WHERE pi.investment_status = 'confirmed'
            ORDER BY maturityDate ASC
        `, { type: QueryTypes.SELECT });

        // Breakdown: withdrawal queue details
        const withdrawalQueueDetails = await sequelize.query(`
            SELECT
                u.full_name AS investorName,
                p.project_name AS projectName,
                pi.unit_purchased * p.unit_investment_value AS capital,
                COALESCE(pi.actual_profit_amount, 0) AS profit,
                pi.actual_profit_percentage AS profitPercent,
                pi.unit_purchased * p.unit_investment_value + COALESCE(pi.actual_profit_amount, 0) AS totalPayable,
                pib.id_project_investment_bookings AS bookingId,
                (${MATURITY_CASE}) AS maturityDate
            FROM project_investors pi
            JOIN projects p ON p.id_projects = pi.id_projects
            JOIN users u ON u.id_users = pi.id_users
            JOIN project_investment_bookings pib ON pib.id_project_investment_bookings = pi.id_project_investment_bookings
            WHERE pi.investment_status = 'ready_for_withdrawal'
            ORDER BY totalPayable DESC
        `, { type: QueryTypes.SELECT });

        // Breakdown: pending payment bookings
        const pendingPaymentDetails = await sequelize.query(`
            SELECT
                pib.id_project_investment_bookings AS bookingId,
                pib.booking_id AS bookingRef,
                u.full_name AS investorName,
                COALESCE(pib.payment_amount, 0) AS amount,
                pib.payment_confirmation_status AS status,
                pib.payment_method AS paymentMethod,
                pib.created_at AS createdAt
            FROM project_investment_bookings pib
            JOIN users u ON u.id_users = pib.id_users
            WHERE pib.payment_confirmation_status IN ('pending', 'uploaded')
              AND pib.cancelled = 'no'
            ORDER BY pib.created_at DESC
        `, { type: QueryTypes.SELECT });

        // Breakdown: investors with confirmed investments
        const investorDetails = await sequelize.query(`
            SELECT
                u.full_name AS investorName,
                u.phone_number AS phone,
                COUNT(DISTINCT pi.id_project_investors) AS investmentCount,
                COALESCE(SUM(pi.unit_purchased * p.unit_investment_value), 0) AS totalCapital,
                SUM(CASE WHEN pi.investment_status = 'ready_for_withdrawal' THEN 1 ELSE 0 END) AS pendingWithdrawal,
                GROUP_CONCAT(DISTINCT p.project_name ORDER BY p.project_name SEPARATOR ', ') AS projects
            FROM project_investors pi
            JOIN users u ON u.id_users = pi.id_users
            JOIN projects p ON p.id_projects = pi.id_projects
            WHERE pi.investment_status = 'confirmed'
            GROUP BY pi.id_users, u.full_name, u.phone_number
            ORDER BY totalCapital DESC
        `, { type: QueryTypes.SELECT });

        // Matured confirmed investments needing action
        const maturedInvestments = await sequelize.query(`
            SELECT COUNT(*) AS maturedCount
            FROM project_investors pi
            JOIN projects p ON p.id_projects = pi.id_projects
            WHERE pi.investment_status = 'confirmed'
              AND pi.actual_profit_amount IS NULL
              AND (${MATURITY_CASE}) <= CURDATE()
        `, { type: QueryTypes.SELECT }) as any[];

        return res.status(200).json({
            success: true,
            data: {
                totalInvestment: Number(totalInvestmentRow?.totalInvestment || 0),
                totalFreshCapital: Number(totalInvestmentRow?.totalFreshCapital || 0),
                totalReinvestedCapital: Number(totalInvestmentRow?.totalReinvestedCapital || 0),
                withdrawalQueue: Number(withdrawalQueueRow?.withdrawalQueueTotal || 0),
                withdrawalQueueCount: Number(withdrawalQueueRow?.withdrawalQueueCount || 0),
                pendingPaymentConfirmations: Number(pendingPaymentRow?.pendingPaymentConfirmations || 0),
                pendingCollections: Number(pendingCollectionsRow?.pendingCollections || 0),
                pendingCollectionsAmount: Number(pendingCollectionsRow?.pendingCollectionsAmount || 0),
                totalInvestors: Number(investorsRow?.totalInvestors || 0),
                newInvestorsThisMonth: Number(investorsRow?.newInvestorsThisMonth || 0),
                maturedNeedingAction: Number(maturedInvestments[0]?.maturedCount || 0),
                investmentByProject,
                investmentByType,
                payables: {
                    d15: { count: Number(p15?.count || 0), profitOnly: Number(p15?.profitOnly || 0), profitPlusCapital: Number(p15?.profitPlusCapital || 0) },
                    d30: { count: Number(p30?.count || 0), profitOnly: Number(p30?.profitOnly || 0), profitPlusCapital: Number(p30?.profitPlusCapital || 0) },
                    m2:  { count: Number(p60?.count || 0), profitOnly: Number(p60?.profitOnly || 0), profitPlusCapital: Number(p60?.profitPlusCapital || 0) },
                    m3:  { count: Number(p90?.count || 0), profitOnly: Number(p90?.profitOnly || 0), profitPlusCapital: Number(p90?.profitPlusCapital || 0) },
                },
                payableDetails: {
                    d15: pd15,
                    d30: pd30,
                    m2:  pd60,
                    m3:  pd90,
                },
                monthlyTrend,
                topPartners,
                activeInvestmentDetails,
                withdrawalQueueDetails,
                pendingPaymentDetails,
                investorDetails,
            },
        });
    } catch (error) {
        return res.status(400).json({ success: false, message: (error as Error).message });
    }
}
