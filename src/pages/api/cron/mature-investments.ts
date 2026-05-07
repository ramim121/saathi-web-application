import { NextApiRequest, NextApiResponse } from 'next';
import sequelize from '@/config/db';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '@/config/constants';
import JWTPayload from '@/types/JWTPayload';
import { QueryTypes } from 'sequelize';

const MATURED_SQL = `
    SELECT
        pi.id_project_investors AS idProjectInvestors,
        pi.id_users AS idUsers,
        pi.unit_purchased AS unitPurchased,
        pi.investment_date AS investmentDate,
        pi.investment_status AS investmentStatus,
        p.project_name AS projectName,
        p.duration,
        p.tenure,
        p.unit_investment_value AS unitInvestmentValue,
        CASE
            WHEN p.tenure = 'months' THEN DATE_ADD(pi.investment_date, INTERVAL p.duration MONTH)
            WHEN p.tenure = 'years'  THEN DATE_ADD(pi.investment_date, INTERVAL p.duration YEAR)
        END AS maturityDate
    FROM project_investors pi
    JOIN projects p ON p.id_projects = pi.id_projects
    WHERE pi.investment_status = 'confirmed'
      AND pi.actual_profit_amount IS NULL
    HAVING maturityDate <= CURDATE()
    ORDER BY maturityDate ASC
`;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'Invalid token' });
    try { jwt.verify(token, JWT_SECRET); } catch { return res.status(401).json({ success: false, message: 'Invalid token' }); }
    const userInfo = jwt.decode(token) as JWTPayload;
    if (userInfo.userType !== 'admin') return res.status(403).json({ success: false, message: 'Access denied' });

    try {
        const matured = await sequelize.query(MATURED_SQL, { type: QueryTypes.SELECT });
        return res.status(200).json({ success: true, count: matured.length, data: matured });
    } catch (error) {
        return res.status(400).json({ success: false, message: (error as Error).message });
    }
}
