import { NextApiRequest, NextApiResponse } from 'next'
import { Project, ProjectPartner, File, ProjectCategory, ProjectProperty } from '@/models/__associations'
import { Op } from 'sequelize'
import sequelize from '@/config/db';

export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse
): Promise<void> {
	if (req.method === 'GET') {
		const { projectName, projectStatus, showInUpcoming, projectCategory, investmentType, investmentRangeFrom, investmentRangeTo, returnRangeFrom, returnRangeTo, location } = req.query;

		const whereClause:
			{
				projectName?: { [Op.like]: string };
				projectStatus?: { [Op.like]?: string;[Op.ne]?: string };
				showInUpcoming?: { [Op.like]: string };
				investmentType?: { [Op.like]: string };
				unitInvestmentValue?: { [Op.between]?: [string, string];[Op.gte]?: string;[Op.lte]?: string };
				location?: { [Op.like]: string };
				returnRangeMin?: { [Op.gte]?: string };
				returnRangeMax?: { [Op.lte]?: string };
				[Op.and]?: { returnRangeMin?: { [Op.gte]: string }; returnRangeMax?: { [Op.lte]: string } }[]
			} = { projectStatus: { [Op.ne]: 'completed' } };

		const projectCategoryClause: { category_name?: { [Op.like]: string } } = {};

		if (projectName) {
			whereClause.projectName = { [Op.like]: `%${projectName}%` }
		}

		if (projectStatus) {
			whereClause.projectStatus = { [Op.like]: `%${projectStatus}%` }
		}

		if (showInUpcoming) {
			whereClause.showInUpcoming = { [Op.like]: `%${showInUpcoming}%` }
		}

		if (investmentType) {
			whereClause.investmentType = { [Op.like]: `%${investmentType}%` }
		}

		if (projectCategory) {
			projectCategoryClause.category_name = { [Op.like]: `%${projectCategory}%` }
		}

		if (investmentRangeFrom && investmentRangeTo) {
			whereClause.unitInvestmentValue = { [Op.between]: [investmentRangeFrom.toString(), investmentRangeTo.toString()] };
		} else if (investmentRangeFrom) {
			whereClause.unitInvestmentValue = { [Op.gte]: investmentRangeFrom.toString() };
		} else if (investmentRangeTo) {
			whereClause.unitInvestmentValue = { [Op.lte]: investmentRangeTo.toString() };
		}
		if (location) {
			whereClause.location = { [Op.like]: `%${location}%` }
		}

		if (returnRangeFrom && returnRangeTo) {
			whereClause[Op.and] = [
				{ returnRangeMin: { [Op.gte]: returnRangeFrom.toString() } },
				{ returnRangeMax: { [Op.lte]: returnRangeTo.toString() } }
			];
		} else if (returnRangeFrom) {
			whereClause.returnRangeMin = { [Op.gte]: returnRangeFrom.toString() };
		} else if (returnRangeTo) {
			whereClause.returnRangeMax = { [Op.lte]: returnRangeTo.toString() };
		}

		try {
			const result = await Project.findAll({
				include: [
					ProjectProperty,
					{
						model: ProjectPartner, as: 'ProjectPartners', required: true,
					},
					{
						model: File, as: 'MainImage', required: false
					},
					{
						model: File, as: 'FeaturedImages', required: false
					},
					{
						model: ProjectCategory,
						as: 'ProjectCategory',
						where: projectCategoryClause
					},
				],
				attributes: {
					include: [
						[
							sequelize.literal(`(
                                SELECT COALESCE(SUM(unit_purchased), 0)
                                FROM project_investors AS ppi
                                WHERE ppi.id_projects = Project.id_projects
								AND ppi.investment_status = 'confirmed'
                            )`),
							'totalInvestedUnits'
						],
						[
							sequelize.literal(`
				                CASE
				                    WHEN Project.total_available_units != 0 THEN Project.total_available_units - (
				                        SELECT SUM(unit_purchased)
				                        FROM project_investors AS ppi
				                        WHERE ppi.id_projects = Project.id_projects
										AND ppi.investment_status != 'confirmed'
				                    )
				                    ELSE NULL
				                END
				            `),
							'totalRemainingUnits'
						],
						[
							sequelize.literal(`(
								SELECT COUNT(*)
								FROM project_investors AS ppi
								WHERE ppi.id_projects = Project.id_projects
								AND ppi.investment_status = 'confirmed'
							)`),
							'investorCount'
						]
					]
				},
				having: sequelize.literal(`
					(totalAvailableUnits = 0 OR totalInvestedUnits < totalAvailableUnits)
				`),
				where: whereClause,
				order: [
					[sequelize.literal(`CASE WHEN projectType = 'special' THEN 0 ELSE 1 END`), 'ASC'],
					[sequelize.literal('investorCount'), 'DESC']
				]
			})

			return res.status(200).json({ success: true, data: result })
		} catch (error) {
			return res.status(400).json({ success: false, message: (error as Error).message })

		}
	} else {
		res.status(405).json({ success: false, message: 'Method not allowed' })
	}
}
