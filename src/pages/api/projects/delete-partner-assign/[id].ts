import { NextApiRequest, NextApiResponse } from 'next';
import { CapacityError, removeAssignment } from '@/utils/partnerCapacity';
import { withCors, requireAdmin } from '@/utils/auth';

/**
 * Detach a partner from a project and give back their unit allocation.
 *
 * SECURITY: previously unauthenticated — anyone could detach any partner and
 * mutate a project's `totalAvailableUnits`. Now admin-only.
 *
 * Also fixed: the original `catch` never rolled the transaction back, so a
 * failure after the `Project.update` left the connection holding an open
 * transaction until it timed out.
 */
async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
    if (req.method !== 'DELETE') {
        res.status(405).json({ success: false, message: 'Method not allowed' });
        return;
    }

    try {
        await removeAssignment(Number(req.query.id));
        res.status(200).json({ success: true, message: 'Partnership Deleted Successfully' });
    } catch (error) {
        if (error instanceof CapacityError) {
            res.status(error.status).json({ success: false, message: error.message });
            return;
        }
        /*
         * project_partner_investors references this row (ON DELETE NO ACTION),
         * so a partnership that has ever carried an allocation cannot be
         * deleted — which protects the investors' money records. Say so in
         * words instead of passing MySQL's constraint text to the admin.
         */
        if ((error as Error).name === 'SequelizeForeignKeyConstraintError') {
            res.status(409).json({
                success: false,
                message: 'This partner has bookings on this project (current or past), so the partnership cannot be removed.',
            });
            return;
        }
        res.status(400).json({ success: false, message: (error as Error).message });
    }
}

export default withCors(requireAdmin(handler));
