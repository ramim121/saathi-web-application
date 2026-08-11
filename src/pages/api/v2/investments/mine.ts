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
} from '@/models/__associations';
import { withCors, requireUser, type AuthContext } from '@/utils/auth';

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
                Project,
                {
                    model: ProjectPartnerInvestor,
                    include: [
                        {
                            model: ProjectPartner,
                            include: [
                                { model: Project },
                                { model: User, include: [{ model: File, as: 'ProfilePicture' }] },
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

            return { ...investment.toJSON(), projectStartDate, projectEndDate };
        });

        return res.status(200).json({ success: true, data: enhanced });
    } catch (error) {
        return res.status(400).json({ success: false, message: (error as Error).message });
    }
}

export default withCors(requireUser(handler));
