import { NextApiRequest, NextApiResponse } from 'next'
import { User, ProjectPartner, Project, File, ProjectCategory } from '@/models/__associations'
import { Op } from 'sequelize'

export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse
): Promise<void> {
	if (req.method === 'GET') {
		const { name, disabilty, fromJoiningDate, toJoiningDate, skills, partnerType, projectCategory } = req.query

		// Constructing the whereClause for the User model
		const whereClause: {
			userType: string;
			fullName?: { [Op.like]: string };
			disability?: { [Op.like]: string };
			joiningDate?: { [Op.between]?: string[];[Op.gte]?: string;[Op.lte]?: string };
			skills?: { [Op.like]: string };
			partnerType?: { [Op.in]: string[] }
		} = { userType: 'partner' };

		// Constructing the projectCategoryClause for the ProjectCategory model
		const projectCategoryClause: { categoryName?: { [Op.like]: string } } = {};

		// Applying filters based on query parameters
		if (name) {
			whereClause.fullName = { [Op.like]: `%${name}%` };
		}
		if (disabilty) {
			whereClause.disability = { [Op.like]: `%${disabilty}%` };
		}
		if (fromJoiningDate && toJoiningDate) {
			whereClause.joiningDate = { [Op.between]: [fromJoiningDate.toString(), toJoiningDate.toString()] };
		} else if (fromJoiningDate) {
			whereClause.joiningDate = { [Op.gte]: fromJoiningDate.toString() };
		} else if (toJoiningDate) {
			whereClause.joiningDate = { [Op.lte]: toJoiningDate.toString() };
		}
		if (skills) {
			whereClause.skills = { [Op.like]: `%${skills}%` };
		}
		if (partnerType) {
			whereClause.partnerType = { [Op.in]: Array.isArray(partnerType) ? partnerType : [partnerType] };
		}

		if (projectCategory) {
			projectCategoryClause.categoryName = { [Op.like]: `%${projectCategory}%` };
		}

		try {
			// Fetching the User data with related models, filtering based on conditions
			const result = await User.findAll({
				include: [
					{
						model: ProjectPartner,
						as: 'Partnerships',
						include: [
							{
								model: Project,
								as: 'Project',
								attributes: ['projectName', 'location'],
								include: [
									{
										model: ProjectCategory,
										as: 'ProjectCategory',
										where: projectCategoryClause,
										required: true
									}
								]
							}
						]
					},
					{
						model: File,
						as: 'ProfilePicture'
					}
				],
				where: whereClause
			});

			// Returning the filtered data
			return res.status(200).json({ success: true, data: result });
		} catch (error) {
			// Handling errors
			return res.status(500).json({ success: false, message: (error as Error).message });
		}
	} else {
		// Method not allowed for non-GET requests
		res.status(405).json({ success: false, message: 'Method not allowed' });
	}
}
