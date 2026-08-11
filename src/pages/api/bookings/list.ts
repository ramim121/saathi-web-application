import { NextApiRequest, NextApiResponse } from 'next'
import { ProjectInvestor, Project, ProjectPartnerInvestor, User, ProjectPartner, ProjectInvestmentBooking } from '@/models/__associations'
import { Op } from 'sequelize'
import Cors from 'micro-cors';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '@/config/constants';
import JWTPayload from '@/types/JWTPayload';
import { safeOrder } from '@/utils/order';
const cors = Cors({
	origin: '*',
	allowMethods: ['GET', 'POST', 'OPTIONS', 'PUT'],
	allowHeaders: ['X-Requested-With', 'Authorization', 'Content-Type'],
});

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

	if (userInfo.userType !== 'admin') return res.status(403).json({ success: false, message: 'Access denied' });

	const { idProjectInvestmentBookings, bookingId, investorName, paymentConfirmationStatus, cancelled, orderBy, orderType, page, pageSize } = req.query;

	const whereClause: any = {};
	if (idProjectInvestmentBookings) whereClause.idProjectInvestmentBookings = { [Op.like]: `%${idProjectInvestmentBookings}%` };
	if (bookingId) whereClause.bookingId = { [Op.like]: `%${bookingId}%` };
	if (paymentConfirmationStatus) whereClause.paymentConfirmationStatus = { [Op.like]: `%${paymentConfirmationStatus}%` };
	if (cancelled) whereClause.cancelled = { [Op.like]: `%${cancelled}%` };


	const limit = parseInt(pageSize as string) || 10;
	const offset = (parseInt(page as string) - 1) * limit || 0;

		try {
		const result = await ProjectInvestmentBooking.findAndCountAll({
			where: whereClause,
			include: [
				{
					model: User,
					attributes: ['idUsers', 'fullName'],
					where: investorName ? { fullName: { [Op.like]: `%${investorName}%` } } : undefined,
				},
				{
					model: ProjectInvestor,
					include: [
						{
							model: Project,
							attributes: ['idProjects', 'projectName', 'duration', 'tenure'],
						},
						{
							model: ProjectPartnerInvestor,
							include: [
								{
									model: ProjectPartner,
									include: [
										{
											model: User,
											attributes: ['idUsers', 'fullName'],
										},
									],
								},
							],
						},
					],
				},
			],
			distinct: true,
			limit,
			offset,
			order: safeOrder(ProjectInvestmentBooking, orderBy, orderType, 'createdAt', 'ASC'),
		});

		const rowsWithMaturity = result.rows.map((booking: any) => {
			const bookingPlain = booking.get ? booking.get({ plain: true }) : booking;

			if (bookingPlain.ProjectInvestors) {
				bookingPlain.ProjectInvestors = bookingPlain.ProjectInvestors.map((projectInvestor: any) => {
					const investmentDate = bookingPlain.paymentDate
						? new Date(bookingPlain.paymentDate)
						: projectInvestor.investmentDate
							? new Date(projectInvestor.investmentDate)
							: null;

					const duration = projectInvestor.Project?.duration || 0;
					const tenure = projectInvestor.Project?.tenure || 'months';

					let projectStartDate = null;
					let maturityDate = null;

					if (investmentDate) {
						const endDate = new Date(investmentDate);
						if (tenure === 'months') {
							endDate.setMonth(endDate.getMonth() + duration);
						} else if (tenure === 'years') {
							endDate.setFullYear(endDate.getFullYear() + duration);
						}
						projectStartDate = investmentDate.toISOString().split('T')[0];
						maturityDate = endDate.toISOString().split('T')[0];
					}

					return {
						...projectInvestor,
						projectStartDate,
						maturityDate,
					};
				});
			}

			return bookingPlain;
		});

		res.status(200).json({
			success: true,
			data: rowsWithMaturity,
			total: result.count,
			currentPage: page ? parseInt(page as string) : 1,
			totalPages: Math.ceil(result.count / limit),
		});
	} catch (error) {
		res.status(400).json({ success: false, message: (error as Error).message });
	}
}

export default cors(handler as any);
