import { NextApiRequest, NextApiResponse } from 'next'
import { User, ProjectPartner, Project, ProjectCategory, File, ProjectProperty } from '@/models/__associations'
import sequelize from '@/config/db';
import { Op } from 'sequelize'
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '@/config/constants';
import JWTPayload from '@/types/JWTPayload';
import { safeOrder } from '@/utils/order';

export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse
): Promise<void> {
	if (req.method === 'GET') {
		let tokenData = req.headers.authorization;
		let token = tokenData?.split(' ')[1];

		if (!token || jwt.verify(token, JWT_SECRET) === null) { res.status(401).json({ success: false, message: 'Invalid token' }); return; }

		let userInfo = jwt.decode(token) as JWTPayload;
		if (userInfo.userType !== 'admin') { res.status(403).json({ success: false, message: 'Access denied' }); return; }

		const { idProjects, projectName, returnRangeMin, returnRangeMax, investmentType, returnType, duration, location, unitInvestmentValue, projectStatus, partnersName, createdBy, showInUpcoming, categoryName, totalAvailableUnits, investorUnitCapacity, orderBy, orderType, page, pageSize } = req.query;

		let whereClause: { idProjects?: { [Op.like]: string }; projectName?: { [Op.like]: string }; returnRangeMin?: { [Op.like]: string }; returnRangeMax?: { [Op.like]: string }; investmentType?: { [Op.like]: string }; returnType?: { [Op.like]: string }; duration?: { [Op.like]: string }; location?: { [Op.like]: string }; unitInvestmentValue?: { [Op.like]: string }; projectStatus?: { [Op.like]: string }; showInUpcoming?: { [Op.like]: string }; totalAvailableUnits?: { [Op.like]: string }; investorUnitCapacity?: { [Op.like]: string } } = {};

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

		if (totalAvailableUnits) {
			whereClause = { ...whereClause, totalAvailableUnits: { [Op.like]: `%${totalAvailableUnits}%` } };
		}

		if (investorUnitCapacity) {
			whereClause = { ...whereClause, investorUnitCapacity: { [Op.like]: `%${investorUnitCapacity}%` } };
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
					'showInUpcoming',
					'totalAvailableUnits',
					'investorUnitCapacity',
					[sequelize.literal(`(
						SELECT COALESCE(SUM(unit_purchased), 0)
						FROM project_investors AS ppi
						WHERE ppi.id_projects = Project.id_projects
						AND ppi.investment_status = 'confirmed'
					)`),
						'alreadyInvested'],
					[
						sequelize.literal(`
                                CASE
                                    WHEN Project.total_available_units != 0 THEN Project.total_available_units - (
                                        SELECT COALESCE(SUM(unit_purchased), 0)
                                        FROM project_investors AS ppi
                                        WHERE ppi.id_projects = Project.id_projects
                                        AND ppi.investment_status = 'confirmed'
                                    )
                                    ELSE 0
                                END
                            `),
						'totalRemainingUnits'
					]
				],
				include: [
					ProjectProperty,
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
					},
					{
						model: ProjectCategory,
						as: 'ProjectCategory',
						where: categoryName ? { categoryName: { [Op.like]: `%${categoryName}%` } } : undefined
					},
					{
						model: File, as: 'MainImage'
					}
				],
				limit,
				offset,
				order: safeOrder(Project, orderBy, orderType, 'idProjects', 'ASC'),
			})

			return res.status(200).json({
				success: true,
				data: result.rows,
				total: result.count,
				currentPage: page ? parseInt(page as string) : 1,
				totalPages: Math.ceil(result.count / limit)
			})
		} catch (error) {
			return res.status(400).json({ success: false, message: (error as Error).message })
		}
	} else {
		res.status(405).json({ success: false, message: 'Method not allowed' })
	}
}
