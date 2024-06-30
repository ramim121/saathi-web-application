import { NextApiRequest, NextApiResponse } from 'next'
import { User, ProjectPartner, Project, File } from '@/models/__associations'
import { Op } from 'sequelize'

export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse
): Promise<void> {
	if (req.method === 'GET') {
		const { name, disabilty, fromJoiningDate, toJoiningDate, skills } = req.query
		const whereClause: { userType: string; fullName?: { [Op.like]: string }; disability?: { [Op.like]: string }; joiningDate?: { [Op.between]: string[] }; skills?: { [Op.like]: string } } = { userType: 'partner' };

		if (name) {
			whereClause.fullName = { [Op.like]: `%${name}%` };
		}
		if (disabilty) {
			whereClause.disability = { [Op.like]: `%${disabilty}%` };
		}
		if (fromJoiningDate && toJoiningDate) {
			whereClause.joiningDate = { [Op.between]: [fromJoiningDate.toString(), toJoiningDate.toString()] };
		}
		if (skills) {
			whereClause.skills = { [Op.like]: `%${skills}%` };
		}

		try {
			const result = await User.findAll({
				attributes: [
					'idUsers',
					'fullName',
					'phoneNumber',
					'age',
					'location',
					'role',
					'joiningDate',
					'skills',
					'disability',
				],
				include: [{
					model: ProjectPartner, as: 'Partnerships',
					include: [
						{ model: Project, as: 'Project', attributes: ['projectName', 'location'] }
					]

				},
				{ model: File, as: 'ProfilePicture' }
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
