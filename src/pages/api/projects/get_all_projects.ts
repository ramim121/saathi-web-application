import { NextApiRequest, NextApiResponse } from 'next'
import { Project, ProjectPartner, File, ProjectCategory } from '@/models/__associations'

export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse
): Promise<void> {
	if (req.method === 'GET') {
		const { projectName, projectStatus, showInUpcoming, projectCategory, investmentType } = req.query;

		const whereClause: { projectName?: string, projectStatus?: string; showInUpcoming?: string; investmentType?: string } = {};
		const projectCategoryClause: { category_name?: string } = {};

		if (projectName) {
			whereClause.projectName = projectName as string;
		}

		if (projectStatus) {
			whereClause.projectStatus = projectStatus as string;
		}

		if (showInUpcoming) {
			whereClause.showInUpcoming = showInUpcoming as string;
		}

		if (projectCategory) {
			projectCategoryClause.category_name = projectCategory as string;
		}

		if (investmentType) {
			whereClause.investmentType = investmentType as string;
		}

		try {
			const result = await Project.findAll({
				include: [
					{
						model: ProjectPartner, as: 'ProjectPartners', required: false
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
				where: whereClause
			})

			return res.status(200).json({ success: true, data: result })
		} catch (error) {
			return res.status(500).json({ success: false, message: (error as Error).message })

		}
	} else {
		res.status(405).json({ success: false, message: 'Method not allowed' })
	}
}
