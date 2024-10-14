import { NextApiRequest, NextApiResponse } from 'next'
import { ProjectInvestor, Project, ProjectPartnerInvestor, User, ProjectPartner, ProjectInvestmentBooking } from '@/models/__associations'
import { Op } from 'sequelize'
import Cors from 'micro-cors';

const cors = Cors({
	origin: '*',
	allowMethods: ['GET', 'POST', 'OPTIONS', 'PUT'],
	allowHeaders: ['X-Requested-With', 'Authorization', 'Content-Type'],
});

async function handler(
	req: NextApiRequest,
	res: NextApiResponse
) {
	if (req.method === 'OPTIONS') { return res.status(200).end(); }
	if (req.method === 'GET') {
		const { idProjectInvestmentBookings, bookingId, investorName, paymentConfirmationStatus, orderBy, orderType, page, pageSize } = req.query;
		let whereClause: { idProjectInvestmentBookings?: { [Op.like]: string }; bookingId?: { [Op.like]: string }; paymentConfirmationStatus?: { [Op.like]: string } } = {};

		if (idProjectInvestmentBookings) {
			whereClause = { ...whereClause, idProjectInvestmentBookings: { [Op.like]: `%${idProjectInvestmentBookings}%` } };
		}

		if (bookingId) {
			whereClause = { ...whereClause, idProjectInvestmentBookings: { [Op.like]: `%${bookingId}%` } };
		}

		if (paymentConfirmationStatus) {
			whereClause = { ...whereClause, paymentConfirmationStatus: { [Op.like]: `%${paymentConfirmationStatus}%` } };
		}

		const limit = pageSize ? parseInt(pageSize as string) : 10;
		const offset = page ? (parseInt(page as string) - 1) * limit : 0;

		try {

			const result = await ProjectInvestmentBooking.findAndCountAll({
				where: whereClause,
				include: [
					{
						model: User,
						where: investorName ? { fullName: { [Op.like]: `%${investorName}%` } } : undefined,
					},
					{
						model: ProjectInvestor,
						include: [
							{
								model: Project,
								// where: projects ? { projectName: { [Op.like]: `%${projects}%` } } : undefined,
							},
							{
								model: ProjectPartnerInvestor,
								include: [
									{
										model: ProjectPartner,
										include: [
											{
												model: User,
											}
										]
									}
								]
							}
						]
					}
				],
				limit,
				offset,
				order: [[orderBy as string, orderType === 'DESC' ? 'DESC' : 'ASC']],
			})

			return res.status(200).json({
				success: true,
				data: result.rows,
				total: result.count,
				currentPage: page ? parseInt(page as string) : 1,
				totalPages: Math.ceil(result.count / limit)
			})
		} catch (error) {
			return res.status(500).json({ success: false, message: (error as Error).message })
		}
	} else {
		res.status(405).json({ success: false, message: 'Method not allowed' })
	}
}

export default cors(handler as any);