import { NextApiRequest, NextApiResponse } from 'next';
import { ProjectInvestor, ProjectInvestmentBooking, Project, ProjectPartnerInvestor } from '@/models/__associations';
import sequelize from '@/config/db';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '@/config/constants';
import JWTPayload from '@/types/JWTPayload';
import ProjectInvestorStatusEntry from '@/utils/ProjectInvestorStatusEntry';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'PUT') {
        return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, message: 'Invalid token' });
    try { jwt.verify(token, JWT_SECRET); } catch { return res.status(401).json({ success: false, message: 'Invalid token' }); }
    const userInfo = jwt.decode(token) as JWTPayload;
    if (userInfo.userType !== 'admin') {
        return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const { idProjectInvestors, idProjects, unitPurchased, topUpAmount, reinvestType, actualProfitAmount, actualProfitPercentage, partners } = req.body;

    if (!idProjectInvestors || !idProjects || !unitPurchased || !reinvestType) {
        return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const transaction = await sequelize.transaction();
    try {
        // Fetch source investor with its booking and project
        const sourceInvestor = await ProjectInvestor.findByPk(idProjectInvestors, {
            include: [ProjectInvestmentBooking, Project],
            transaction,
        });
        if (!sourceInvestor) {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: 'Source investment not found' });
        }
        if (sourceInvestor.investmentStatus !== 'ready_for_withdrawal') {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: 'Investment is not in ready_for_withdrawal status' });
        }

        const sourceBooking = sourceInvestor.ProjectInvestmentBooking as any;
        const capital = Number(sourceInvestor.unitPurchased) * Number((sourceInvestor as any).Project.unitInvestmentValue);
        const profit = Number(actualProfitAmount) || Number(sourceInvestor.actualProfitAmount) || 0;
        const profitPercent = Number(actualProfitPercentage) || Number(sourceInvestor.actualProfitPercentage) || 0;

        // Fetch target project for unit value and amount validation
        const targetProject = await Project.findByPk(idProjects, { transaction });
        if (!targetProject) {
            await transaction.rollback();
            return res.status(404).json({ success: false, message: 'Target project not found' });
        }
        const targetUnitValue = Number((targetProject as any).unitInvestmentValue);
        const reinvestValue = Number(unitPurchased) * targetUnitValue;
        const topUp = Number(topUpAmount || 0);

        // Amount validation before any DB writes
        if (reinvestType === 'capital_only' && reinvestValue > capital) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: `Reinvestment value (BDT ${reinvestValue.toLocaleString()}) exceeds available capital (BDT ${capital.toLocaleString()})`,
            });
        }
        if (reinvestType === 'full' && reinvestValue > capital + profit + topUp) {
            await transaction.rollback();
            return res.status(400).json({
                success: false,
                message: `Reinvestment value (BDT ${reinvestValue.toLocaleString()}) exceeds available amount (BDT ${(capital + profit + topUp).toLocaleString()})`,
            });
        }

        // Compute reinvested amount and total payment
        const reinvestedAmount = reinvestType === 'full' ? capital + profit : capital;
        const paymentAmount = reinvestedAmount + topUp;

        // Generate bookingId (same pattern as create.ts)
        const maximumBookingId = await (ProjectInvestmentBooking as any).max('bookingId', { transaction });
        const newBookingRef = (maximumBookingId ? parseInt(String(maximumBookingId)) + 1 : 1).toString().padStart(6, '0');

        // Determine new status for source investor
        const newSourceStatus = reinvestType === 'full' ? 'reinvested_full' : 'reinvested_capital';

        // Update source investor
        sourceInvestor.investmentStatus = newSourceStatus;
        sourceInvestor.actualProfitAmount = profit;
        sourceInvestor.actualProfitPercentage = profitPercent;
        await sourceInvestor.save({ transaction });

        // Log status change for source
        await ProjectInvestorStatusEntry(newSourceStatus, idProjectInvestors, userInfo.idUsers, '', transaction);

        // Create new booking (reinvestment), inheriting source proof of payment
        const newBooking = await (ProjectInvestmentBooking as any).create({
            idUsers: sourceInvestor.idUsers,
            bookingId: newBookingRef,
            paymentConfirmationStatus: 'confirmed',
            paymentAmount,
            paymentDate: new Date(),
            cancelled: 'no',
            bookingType: 'reinvestment',
            reinvestedAmount,
            idSourceProjectInvestors: idProjectInvestors,
            proofOfPayment: sourceBooking?.proofOfPayment || null,
        }, { transaction });

        // Create new project investor (confirmed)
        const newInvestor = await ProjectInvestor.create({
            idProjects,
            idUsers: sourceInvestor.idUsers,
            idProjectInvestmentBookings: newBooking.idProjectInvestmentBookings,
            unitPurchased: Number(unitPurchased),
            investmentStatus: 'confirmed',
            investmentDate: new Date().toISOString().split('T')[0],
        } as any, { transaction });

        // Log status for new investor
        await ProjectInvestorStatusEntry('confirmed', newInvestor.idProjectInvestors as number, userInfo.idUsers, `Reinvestment from booking #${sourceBooking?.bookingId || idProjectInvestors}`, transaction);

        // Create partner assignment records
        for (const partner of (partners || [])) {
            await (ProjectPartnerInvestor as any).create({
                idProjectInvestors: newInvestor.idProjectInvestors,
                idProjectPartners: partner.idProjectPartners,
                amountInvested: partner.amountInvested,
                investedUnit: partner.investedUnit,
            }, { transaction });
        }

        await transaction.commit();

        return res.status(200).json({
            success: true,
            message: 'Reinvestment processed successfully',
            data: {
                newBookingId: newBooking.idProjectInvestmentBookings,
                newBookingRef,
                newInvestorId: newInvestor.idProjectInvestors,
            },
        });
    } catch (error) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: (error as Error).message });
    }
}
