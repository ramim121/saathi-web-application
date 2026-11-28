import { NextApiRequest, NextApiResponse } from 'next';
import {
    User,
    ProjectPartner,
    ProjectPartnerInvestor,
    Project,
    ProjectInvestor,
    ProjectInvestmentBooking,
    File,
    ProjectInvestmentBookingStatus,
    ProjectInvestorStatus,
} from '@/models/__associations';
import { withCors, requireUser, type AuthContext } from '@/utils/auth';
import { publicPartnerAttributes } from '@/utils/publicFields';
import { holdFields } from '@/utils/bookingHolds';

/**
 * The signed-in investor's portfolio — the website's "My investments" source.
 *
 * WHY A v2 ROUTE INSTEAD OF LOCKING THE ORIGINAL:
 * `/api/investors/invested-projects/[id]` is unauthenticated and takes the user
 * id from the URL, so anyone can read anyone's portfolio. It cannot simply be
 * locked, because the live mobile app calls it from three screens
 * (MyInvestedProjects, MyInvestment, PendingProofOfPaymentList) and its fetch
 * helper treats a 401 as a forced logout — clearing the token, emitting
 * `onLogout` and alerting "Please login again". Locking it in place would eject
 * every user of the shipped app.
 *
 * So the original is left exactly as it is, and this route exists alongside it.
 * The difference that matters: the user id comes from the verified token, not
 * from the URL, so there is no id to tamper with. Retire the old route once the
 * app has migrated.
 */
async function handler(req: NextApiRequest, res: NextApiResponse, auth: AuthContext) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

    try {
        const result = await ProjectInvestor.findAll({
            include: [
                // Main image for the Portfolio cards (file name and thumbnail only).
                { model: Project, include: [{ model: File, as: 'MainImage', attributes: ['fileName', 'thumbnail', 'originalFileName'] }] },
                {
                    model: ProjectPartnerInvestor,
                    include: [
                        {
                            model: ProjectPartner,
                            include: [
                                { model: Project },
                                // The partner farmer: public profile fields only, as in
                                // investors/invested-projects. This sent the whole row
                                // (phone, email, NID fields) to every investor.
                                { model: User, attributes: publicPartnerAttributes(), include: [{ model: File, as: 'ProfilePicture' }] },
                            ],
                        },
                    ],
                },
                {
                    model: User,
                    // Token-derived, not caller-supplied.
                    where: { idUsers: auth.idUsers },
                    include: [{ model: File, as: 'ProfilePicture' }],
                },
                {
                    model: ProjectInvestmentBooking,
                    include: [
                        {
                            model: ProjectInvestmentBookingStatus,
                            where: { status: 'confirmed' },
                            required: false,
                        },
                    ],
                    where: { cancelled: 'no' },
                },
            ],
            order: [['idProjectInvestmentBookings', 'DESC']],
        });

        // Derive the project window from the payment date plus the tenure, the
        // same way the original route does.
        const enhanced = result.map((investment: any) => {
            const investmentDate = investment?.ProjectInvestmentBooking?.paymentDate
                ? new Date(investment.ProjectInvestmentBooking.paymentDate)
                : new Date(investment.investmentDate);

            const project = investment.ProjectPartnerInvestors?.[0]?.ProjectPartner?.Project;
            const duration = project?.duration || 0;
            const tenure = project?.tenure || 'months';

            let projectStartDate: string | null = null;
            let projectEndDate: string | null = null;

            const endDate = new Date(investmentDate);
            if (!Number.isNaN(endDate.getTime())) {
                if (tenure === 'years') endDate.setFullYear(endDate.getFullYear() + duration);
                else endDate.setMonth(endDate.getMonth() + duration);

                projectStartDate = investmentDate.toISOString().split('T')[0];
                projectEndDate = endDate.toISOString().split('T')[0];
            }

            const json = investment.toJSON();
            // The booking's payment deadline and derived state (utils/bookingHolds.ts).
            if (json.ProjectInvestmentBooking) json.ProjectInvestmentBooking = { ...json.ProjectInvestmentBooking, ...holdFields(json.ProjectInvestmentBooking) };
            return { ...json, projectStartDate, projectEndDate };
        });

        // What the investor asked for on payout-due lines (see payout-request.ts):
        // withdraw is the line status itself; a reinvest request lives only in
        // the line's status history.
        const dueIds = enhanced
            .filter((l: any) => l.investmentStatus === 'ready_for_withdrawal' || l.investmentStatus === 'request_withdrawal')
            .map((l: any) => l.idProjectInvestors);
        const requests = dueIds.length
            ? await ProjectInvestorStatus.findAll({
                  where: {
                      idProjectInvestors: dueIds,
                      status: ['request_withdrawal', 'reinvest_full_requested', 'reinvest_capital_requested'],
                  },
                  // created_at has one-second precision; the id breaks ties.
                  order: [['createdAt', 'DESC'], ['idProjectInvestorStatus', 'DESC']],
              })
            : [];
        const latestByLine = new Map<number, any>();
        for (const r of requests as any[]) {
            if (!latestByLine.has(r.idProjectInvestors)) latestByLine.set(r.idProjectInvestors, r);
        }
        const withRequests = enhanced.map((l: any) => {
            const latest = latestByLine.get(l.idProjectInvestors);
            let payoutRequest: { choice: string; at: string } | null = null;
            if (l.investmentStatus === 'request_withdrawal') {
                payoutRequest = { choice: 'withdraw', at: latest?.status === 'request_withdrawal' ? latest.createdAt : l.updatedAt };
            } else if (l.investmentStatus === 'ready_for_withdrawal' && latest && latest.status !== 'request_withdrawal') {
                payoutRequest = { choice: String(latest.status).replace(/_requested$/, ''), at: latest.createdAt };
            }
            return { ...l, payoutRequest };
        });

        return res.status(200).json({ success: true, data: withRequests });
    } catch (error) {
        return res.status(400).json({ success: false, message: (error as Error).message });
    }
}

export default withCors(requireUser(handler));
