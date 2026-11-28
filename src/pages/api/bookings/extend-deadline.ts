import type { NextApiRequest, NextApiResponse } from 'next';
import Joi from 'joi';
import sequelize from '@/config/db';
import { ProjectInvestmentBooking, ProjectInvestor, ProjectPartnerInvestor, Project } from '@/models/__associations';
import { requireAdmin, withCors, type AuthContext } from '@/utils/auth';
import BookingStatusEntry from '@/utils/BookingStatusEntry';
import { CapacityError, lockProjects, partnerLoads, unitsUsed } from '@/utils/partnerCapacity';
import { effectiveDue, endOfDhakaDay, formatDue, isAwaitingPayment, remindersDue } from '@/utils/bookingHoldsShared';

/**
 * PUT api/bookings/extend-deadline — an admin moves a booking's payment
 * deadline later (plan 4.7), with a reason that goes into its history as
 * `deadline_extended`.
 *
 *   { idProjectInvestmentBookings, dueDate: 'YYYY-MM-DD', reason }
 *
 * The new deadline is the end of that day, Dhaka time, at most 60 days away.
 * Only a booking awaiting payment (pending, or receipt rejected) has a
 * deadline to move. One whose deadline has already passed no longer holds its
 * units, so extending it holds them again: that is allowed only where the
 * project and its partners still have room for them, as at confirmation.
 */

const MAX_DAYS_AHEAD = 60;

const schema = Joi.object({
    idProjectInvestmentBookings: Joi.number().integer().positive().required(),
    dueDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required().messages({ 'string.pattern.base': 'Choose the new deadline date' }),
    reason: Joi.string().trim().min(3).max(200).required().messages({ 'any.required': 'Give a reason', 'string.empty': 'Give a reason', 'string.min': 'Give a reason' }),
});

async function handler(req: NextApiRequest, res: NextApiResponse, auth: AuthContext) {
    if (req.method !== 'PUT') return res.status(405).json({ success: false, message: 'Method not allowed' });
    const { error, value } = schema.validate(req.body ?? {}, { abortEarly: false });
    if (error) return res.status(400).json({ success: false, message: error.details.map((d) => d.message).join('. <br>') });
    const input = value as { idProjectInvestmentBookings: number; dueDate: string; reason: string };

    // 23:59:59 Dhaka on the chosen day. Noon UTC of that date is the same
    // Dhaka day (18:00), so endOfDhakaDay lands on the right one.
    const due = endOfDhakaDay(`${input.dueDate}T12:00:00Z`);
    const now = new Date();
    if (Number.isNaN(due.getTime())) return res.status(400).json({ success: false, message: 'Choose the new deadline date' });
    if (due.getTime() <= now.getTime()) return res.status(400).json({ success: false, message: 'The new deadline must be in the future.' });
    if (due.getTime() > now.getTime() + MAX_DAYS_AHEAD * 24 * 3600 * 1000) {
        return res.status(400).json({ success: false, message: `The new deadline can be at most ${MAX_DAYS_AHEAD} days away.` });
    }

    // The projects first, outside the transaction, so their locks can be the
    // first thing it does (see bookings/confirm.ts).
    const lineProjects = await ProjectInvestor.findAll({ where: { idProjectInvestmentBookings: input.idProjectInvestmentBookings }, attributes: ['idProjects'] });

    const transaction = await sequelize.transaction();
    try {
        const booking = (await ProjectInvestmentBooking.findByPk(input.idProjectInvestmentBookings, { transaction, lock: transaction.LOCK.UPDATE })) as any;
        if (!booking) {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }
        await lockProjects(lineProjects.map((l) => Number(l.idProjects)), transaction);

        if (booking.cancelled === 'yes') {
            await transaction.rollback();
            return res.status(409).json({ success: false, code: 'BOOKING_CANCELLED', message: 'This booking is cancelled, so it has no deadline to move.' });
        }
        if (!isAwaitingPayment(booking.paymentConfirmationStatus)) {
            await transaction.rollback();
            return res.status(409).json({ success: false, message: 'Only a booking awaiting payment has a deadline. A receipt under review holds its units until it is confirmed or rejected.' });
        }
        const current = effectiveDue(booking);
        if (current && due.getTime() <= current.getTime()) {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: `The deadline is already ${formatDue(current)}. Choose a later day.` });
        }

        // Past its deadline: its units are free, so holding them again needs room.
        if (current && current.getTime() <= now.getTime()) {
            const lines = (await ProjectInvestor.findAll({
                where: { idProjectInvestmentBookings: booking.idProjectInvestmentBookings, investmentStatus: 'booked' },
                include: [{ model: Project, attributes: ['projectName', 'totalAvailableUnits'] }],
                transaction,
            })) as any[];
            const perProject = new Map<number, number>();
            for (const line of lines) perProject.set(Number(line.idProjects), (perProject.get(Number(line.idProjects)) ?? 0) + Number(line.unitPurchased));
            for (const [idProjects, units] of Array.from(perProject.entries())) {
                const project = lines.find((l) => Number(l.idProjects) === idProjects)?.Project;
                const total = Number(project?.totalAvailableUnits) || 0;
                const others = await unitsUsed({ idProjects, excludeBooking: booking.idProjectInvestmentBookings }, transaction);
                if (total > 0 && others + units > total) {
                    throw new CapacityError(`${project?.projectName ?? 'A project'} has ${Math.max(0, total - others)} unit(s) free now and this booking needs ${units}. Its units have gone to other bookings.`, 409, 'PROJECT_CAPACITY');
                }
                const loads = await partnerLoads([idProjects], transaction, { excludeBooking: booking.idProjectInvestmentBookings });
                const rows = (await ProjectPartnerInvestor.findAll({
                    where: { idProjectInvestors: lines.filter((l) => Number(l.idProjects) === idProjects).map((l) => l.idProjectInvestors) },
                    transaction,
                })) as any[];
                const own = new Map<number, number>();
                for (const r of rows) own.set(Number(r.idProjectPartners), (own.get(Number(r.idProjectPartners)) ?? 0) + Number(r.investedUnit));
                for (const [idProjectPartners, mine] of Array.from(own.entries())) {
                    const p = loads.find((l) => l.idProjectPartners === idProjectPartners);
                    if (p && p.capacity > 0 && p.confirmed + p.pending + mine > p.capacity) {
                        throw new CapacityError(`${p.fullName} has room for ${Math.max(0, p.capacity - p.confirmed - p.pending)} unit(s) and this booking holds ${mine} with them. Move its units in the booking page first, or increase the partner's capacity.`, 409, 'PARTNER_CAPACITY');
                    }
                }
            }
        }

        booking.paymentDueAt = due;
        // Reminders start again for the new deadline; any already due are not resent.
        booking.paymentRemindersSent = remindersDue(due, now);
        await booking.save({ transaction });
        await BookingStatusEntry(
            'deadline_extended',
            booking.idProjectInvestmentBookings,
            auth.idUsers,
            `${input.reason} (new deadline ${formatDue(due)}${current ? `, was ${formatDue(current)}` : ''})`.slice(0, 500),
            transaction,
        );
        await transaction.commit();
        return res.status(200).json({ success: true, message: 'Deadline moved', data: { paymentDueAt: due.toISOString() } });
    } catch (err) {
        await transaction.rollback().catch(() => undefined);
        if (err instanceof CapacityError) return res.status(err.status).json({ success: false, code: err.code, message: err.message });
        return res.status(400).json({ success: false, message: (err as Error).message });
    }
}

export default withCors(requireAdmin(handler));
