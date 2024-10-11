import { NextApiRequest, NextApiResponse } from 'next'
import { User, ProjectPartner, Project } from '@/models/__associations'
import { Op } from 'sequelize'


export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse
): Promise<void> {
	if (req.method === 'GET') {
		const { idProjects, projectName, returnRangeMin, returnRangeMax, investmentType, returnType, duration, location, unitInvestmentValue, projectStatus, partnersName, createdBy, showInUpcoming, orderBy, orderType, page, pageSize } = req.query;

		let whereClause: { idProjects?: { [Op.like]: string }; projectName?: { [Op.like]: string }; returnRangeMin?: { [Op.like]: string }; returnRangeMax?: { [Op.like]: string }; investmentType?: { [Op.like]: string }; returnType?: { [Op.like]: string }; duration?: { [Op.like]: string }; location?: { [Op.like]: string }; unitInvestmentValue?: { [Op.like]: string }; projectStatus?: { [Op.like]: string }; showInUpcoming?: { [Op.like]: string } } = {};

		if (idProjects) {
			whereClause = { ...whereClause, idProjects: { [Op.like]: `%${idProjects}%` } };
		}

		if (projectName) {
			whereClause = { ...whereClause, projectName: { [Op.like]: `%${projectName}%` } };
		}

		if (returnRangeMin) {
			whereClause = { ...whereClause, returnRangeMin: { [Op.like]: `%${returnRangeMin}%` } };
		}

		if (returnRangeMax) {
			whereClause = { ...whereClause, returnRangeMax: { [Op.like]: `%${returnRangeMax}%` } };
		}

		if (investmentType) {
			whereClause = { ...whereClause, investmentType: { [Op.like]: `%${investmentType}%` } };
		}

		if (returnType) {
			whereClause = { ...whereClause, returnType: { [Op.like]: `%${returnType}%` } };
		}

		if (duration) {
			whereClause = { ...whereClause, duration: { [Op.like]: `%${duration}%` } };
		}

		if (location) {
			whereClause = { ...whereClause, location: { [Op.like]: `%${location}%` } };
		}

		if (unitInvestmentValue) {
			whereClause = { ...whereClause, unitInvestmentValue: { [Op.like]: `%${unitInvestmentValue}%` } };
		}

		if (projectStatus) {
			whereClause = { ...whereClause, projectStatus: { [Op.like]: `%${projectStatus}%` } };
		}

		if (showInUpcoming) {
			whereClause = { ...whereClause, showInUpcoming: { [Op.like]: `%${showInUpcoming}%` } };
		}

		const limit = pageSize ? parseInt(pageSize as string) : 10;
		const offset = page ? (parseInt(page as string) - 1) * limit : 0;

		try {
			const result = await Project.findAndCountAll({
				where: whereClause,
				distinct: true,
				attributes: [
					'idProjects',
					'projectName',
					'returnRangeMin',
					'returnRangeMax',
					'investmentType',
					'returnType',
					'duration',
					'tenure',
					'location',
					'unitInvestmentValue',
					'projectStatus',
					'showInUpcoming'
				],
				include: [
					{
						model: User,
						as: 'CreatedBy',
						attributes: ['fullName'],
						where: createdBy ? { fullName: { [Op.like]: `%${createdBy}%` } } : undefined, // Adjusted condition for createdBy
					},
					{
						model: ProjectPartner,
						as: 'ProjectPartners',
						include: [
							{
								model: User,
								attributes: ['fullName'],
								where: partnersName ? { fullName: { [Op.like]: `%${partnersName}%` } } : undefined, // Adjusted condition for partnersName
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
