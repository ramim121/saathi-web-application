import { NextApiRequest, NextApiResponse } from 'next'
import { User, ProjectPartner, Project, File, ProjectCategory, PartnerAdditionalInfo } from '@/models/__associations'
import { Op } from 'sequelize'
import { publicPartnerAttributes } from '@/utils/publicFields'

export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse
): Promise<void> {
	if (req.method === 'GET') {
		const { name, disability, fromJoiningDate, toJoiningDate, skills, partnerType, projectCategory } = req.query

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
		if (disability) {
			whereClause.disability = { [Op.like]: `%${disability}%` };
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
				// SECURITY: this endpoint is public (the app's Partners tab is reachable
				// before login), so the projection is an explicit allowlist. Without it
				// Sequelize returns every users column — which on a production row means
				// email, phoneNumber, nidNumber and the NID image keys go out unauthenticated.
				// Only add a column here if it is safe for an anonymous caller to read.
				// `disability` stays because the app renders it as a badge and filters on it.
				attributes: publicPartnerAttributes(),
				include: [
					{
						model: ProjectPartner,
						as: 'Partnerships',
						required: true,
						include: [
							{
								model: Project,
								as: 'Project',
								attributes: ['projectName', 'location'],
								required: true,
								include: [
									{
										model: ProjectCategory,
										as: 'ProjectCategory',
										where: projectCategoryClause, // Apply the clause only if projectCategory is provided
										required: true
									}
								]
							}
						],
					},
					{
						model: File,
						as: 'ProfilePicture'
					},
					{
						model: File,
						as: 'FeaturedImages'
					},
					{
						model: PartnerAdditionalInfo,
						as: 'PartnerAdditionalInfo',
					}
				],
				order: [[{ model: File, as: 'ProfilePicture' }, 'fileName', 'DESC']],
				where: whereClause
			});

			// Returning the filtered data
			return res.status(200).json({ success: true, data: result });
		} catch (error) {
			// Handling errors
			return res.status(400).json({ success: false, message: (error as Error).message });
		}
	} else {
		// Method not allowed for non-GET requests
		res.status(405).json({ success: false, message: 'Method not allowed' });
	}
}
