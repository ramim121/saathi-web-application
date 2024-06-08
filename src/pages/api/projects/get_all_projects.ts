import { NextApiRequest, NextApiResponse } from 'next'
import { Project, ProjectPartner } from '@/models/__associations'
import { Op } from 'sequelize';

export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse
): Promise<void> {
	if (req.method === 'GET') {
		try {
			const result = await Project.findAll({
				attributes: [
					'idProjects',
					'projectName',
					'duration',
					'tenure',
					'location'
				],
				include: [
					{
						model: ProjectPartner, as: 'ProjectPartners', required: false
					}
				]
			})

			return res.status(200).json(result)
		} catch (error) {
			console.error(error)
			return res.status(500).json({ error: 'Server error' })
		}
	} else {
		res.status(405).json({ error: 'Method not allowed' })
	}
}
