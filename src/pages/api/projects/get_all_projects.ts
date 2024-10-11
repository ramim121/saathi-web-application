import { NextApiRequest, NextApiResponse } from 'next'
import { Project, ProjectPartner, File } from '@/models/__associations'

export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse
): Promise<void> {
	if (req.method === 'GET') {
		const { projectStatus, showInUpcoming } = req.query;

		const whereClause: { projectStatus?: string; showInUpcoming?: string } = {};

		if (projectStatus) {
			whereClause.projectStatus = projectStatus as string;
		}

		if (showInUpcoming) {
			whereClause.showInUpcoming = showInUpcoming as string;
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
					}
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
