import { NextApiRequest, NextApiResponse } from 'next';
import { User, File, ProjectPartner, Project, ProjectPartnerInvestor, ProjectInvestor, ProjectInvestmentBooking, PartnerAdditionalInfo } from '@/models/__associations';
import sequelize from '@/config/db';
import { QueryTypes } from 'sequelize';
import { withCors, readAuth } from '@/utils/auth';
import { publicPartnerAttributes } from '@/utils/publicFields';

/**
 * A partner's profile and the projects they still have room on.
 *
 * SECURITY: this route is public — the app's Affiliated Project screen calls
 * it — and it returned the full user row of ANY id, investors included
 * (phone, date of birth, NID image names…), plus, through each partnership,
 * the investors' booking rows (amounts, transaction ids, proof-of-payment file
 * names). Now:
 *   - an admin token gets the full record, as the admin partner pages need;
 *   - everyone else gets partners only, their public profile fields (the
 *     same set the public project route shows), and each partnership's
 *     project — which is all the app reads (`data.Partnerships[].Project`).
 */


const roomLeft = sequelize.literal(`partner_unit_capacity > (
    SELECT IFNULL(SUM(invested_unit),0)
    FROM project_partner_investors AS ppi
    LEFT JOIN project_investors AS pi ON pi.id_project_investors = ppi.id_project_investors
    WHERE ppi.id_project_partners = Partnerships.id_project_partners
    AND pi.investment_status = "confirmed"
)`);

const investedUnits: [ReturnType<typeof sequelize.literal>, string] = [
    sequelize.literal(`(
        SELECT IFNULL(SUM(invested_unit),0)
        FROM project_partner_investors AS ppi
        LEFT JOIN project_investors AS pi ON pi.id_project_investors = ppi.id_project_investors
        WHERE ppi.id_project_partners = Partnerships.id_project_partners
        AND pi.investment_status = 'confirmed'
    )`),
    'alreadyInvestedUnits'
];

/**
 * A partner's track record with Shathi, for the app's partner page.
 *
 * Per project the partner has raised: units and money placed with them by
 * investors (paid bookings only), investors served, and — on lines that have
 * matured with a recorded profit — the profit their share produced. Partners
 * keep 50% of that profit (DigiGram's partner model), shown as their
 * earnings. A line's profit is split by the partner's share of its units.
 * Aggregates only: no investor is identified.
 */
const PAID = ['confirmed', 'ready_for_withdrawal', 'request_withdrawal', 'withdrawn', 'reinvested_full', 'reinvested_capital', 'reinvested_profit'];
const MATURED = ['ready_for_withdrawal', 'request_withdrawal', 'withdrawn', 'reinvested_full', 'reinvested_capital', 'reinvested_profit'];
const PARTNER_PROFIT_SHARE = 0.5;

async function partnerTrackRecord(idUsers: number) {
    if (!Number.isInteger(idUsers) || idUsers <= 0) return null;
    const rows = await sequelize.query<Record<string, unknown>>(
        `SELECT p.id_projects AS idProjects, p.project_name AS projectName, p.project_status AS projectStatus,
                p.duration, p.tenure,
                MIN(b.payment_date) AS firstPayment,
                COALESCE(SUM(ppi.invested_unit), 0) AS units,
                COALESCE(SUM(ppi.amount_invested), 0) AS amount,
                COUNT(DISTINCT pi.id_users) AS investors,
                COALESCE(SUM(CASE WHEN pi.investment_status IN (:matured) THEN ppi.invested_unit ELSE 0 END), 0) AS maturedUnits,
                COALESCE(SUM(CASE WHEN pi.investment_status IN (:matured) AND pi.actual_profit_amount IS NOT NULL
                         THEN pi.actual_profit_amount * ppi.invested_unit / NULLIF(pi.unit_purchased, 0) ELSE 0 END), 0) AS profit
           FROM project_partners pp
           JOIN project_partner_investors ppi ON ppi.id_project_partners = pp.id_project_partners
           JOIN project_investors pi ON pi.id_project_investors = ppi.id_project_investors
           JOIN projects p ON p.id_projects = pp.id_projects
           LEFT JOIN project_investment_bookings b ON b.id_project_investment_bookings = pi.id_project_investment_bookings
          WHERE pp.id_users = :idUsers AND pi.investment_status IN (:paid)
          GROUP BY p.id_projects, p.project_name, p.project_status, p.duration, p.tenure
          ORDER BY firstPayment DESC`,
        { replacements: { idUsers, paid: PAID, matured: MATURED }, type: QueryTypes.SELECT },
    );
    const num = (v: unknown) => Number(v ?? 0) || 0;
    const projects = rows.map((r) => {
        const profit = Math.round(num(r.profit));
        return {
            idProjects: num(r.idProjects),
            projectName: String(r.projectName ?? ''),
            projectStatus: String(r.projectStatus ?? ''),
            duration: num(r.duration),
            tenure: String(r.tenure ?? 'months'),
            firstPayment: r.firstPayment ?? null,
            units: num(r.units),
            amount: Math.round(num(r.amount)),
            investors: num(r.investors),
            maturedUnits: num(r.maturedUnits),
            profit,
            partnerEarnings: Math.round(profit * PARTNER_PROFIT_SHARE),
        };
    });
    const sum = (k: 'units' | 'amount' | 'profit' | 'partnerEarnings' | 'maturedUnits') => projects.reduce((t, p) => t + p[k], 0);
    const [{ investors } = { investors: 0 }] = await sequelize.query<{ investors: number }>(
        `SELECT COUNT(DISTINCT pi.id_users) AS investors
           FROM project_partners pp
           JOIN project_partner_investors ppi ON ppi.id_project_partners = pp.id_project_partners
           JOIN project_investors pi ON pi.id_project_investors = ppi.id_project_investors
          WHERE pp.id_users = :idUsers AND pi.investment_status IN (:paid)`,
        { replacements: { idUsers, paid: PAID }, type: QueryTypes.SELECT },
    );
    return {
        projects,
        totals: {
            projects: projects.length,
            completedProjects: projects.filter((p) => p.maturedUnits > 0 && p.maturedUnits === p.units).length,
            units: sum('units'),
            amount: sum('amount'),
            investors: num(investors),
            profit: sum('profit'),
            partnerEarnings: sum('partnerEarnings'),
        },
        partnerProfitShare: PARTNER_PROFIT_SHARE,
    };
}

async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    if (req.method === 'GET') {
        const admin = readAuth(req)?.userType === 'admin';
        try {
            const result = admin
                ? await User.findOne({
                    where: {
                        idUsers: req.query.id
                    },
                    include: [
                        { model: File, as: 'ProfilePicture' },
                        { model: File, as: 'FeaturedImages' },
                        { model: PartnerAdditionalInfo, as: 'PartnerAdditionalInfo' },
                        {
                            model: ProjectPartner, as: 'Partnerships',
                            attributes: ['partnerUnitCapacity', investedUnits],
                            include: [
                                {
                                    model: Project, as: 'Project',
                                    where: { projectStatus: 'created' },
                                    include: [
                                        { model: File, as: 'MainImage' },
                                        { model: File, as: 'FeaturedImages' }]
                                },
                                {
                                    model: ProjectPartnerInvestor,
                                    required: false,
                                    include: [
                                        {
                                            model: ProjectInvestor,
                                            include: [
                                                { model: ProjectInvestmentBooking }
                                            ]
                                        }
                                    ]
                                }
                            ],
                            where: roomLeft,
                            required: false
                        }
                    ],
                })
                : await User.findOne({
                    where: {
                        idUsers: req.query.id,
                        userType: 'partner'
                    },
                    attributes: publicPartnerAttributes(),
                    include: [
                        { model: File, as: 'ProfilePicture' },
                        { model: File, as: 'FeaturedImages' },
                        {
                            model: ProjectPartner, as: 'Partnerships',
                            attributes: ['partnerUnitCapacity', investedUnits],
                            include: [
                                {
                                    model: Project, as: 'Project',
                                    where: { projectStatus: 'created' },
                                    include: [
                                        { model: File, as: 'MainImage' },
                                        { model: File, as: 'FeaturedImages' }]
                                }
                            ],
                            where: roomLeft,
                            required: false
                        }
                    ],
                });

            const trackRecord = result ? await partnerTrackRecord(Number(req.query.id)) : null;
            return res.status(200).json({ success: true, data: result, trackRecord });
        } catch (error) {
            return res.status(400).json({ success: false, message: (error as Error).message })
        }
    } else {
        res.status(405).json({ success: false, message: 'Method not allowed' })
    }
}

export default withCors(handler);
