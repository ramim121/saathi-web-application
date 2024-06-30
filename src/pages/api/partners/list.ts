import { NextApiRequest, NextApiResponse } from 'next'
import { User, ProjectPartner, Project } from '@/models/__associations'
import { Op } from 'sequelize'

export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse
): Promise<void> {
	if (req.method === 'GET') {
		const { fullName, phoneNumber, age, location, role, joiningDate, skills, idUsers, disability, orderBy, orderType, page, pageSize } = req.query

		let whereClause: { userType: string; fullName?: { [Op.like]: string }; phoneNumber?: { [Op.like]: string }; age?: { [Op.like]: string }; location?: { [Op.like]: string }; idUsers?: { [Op.like]: string }; skills?: { [Op.like]: string }; role?: { [Op.like]: string }; joiningDate?: { [Op.like]: string }; disability?: { [Op.like]: string } } = { userType: 'partner' };

		if (fullName) {
			whereClause = { ...whereClause, fullName: { [Op.like]: `%${fullName}%` } };
		}
		if (phoneNumber) {
			whereClause = { ...whereClause, phoneNumber: { [Op.like]: `%${phoneNumber}%` } };
		}
		if (age) {
			whereClause = { ...whereClause, age: { [Op.like]: `%${age}%` } };
		}
		if (location) {
			whereClause = { ...whereClause, location: { [Op.like]: `%${location}%` } };
		}
		if (role) {
			whereClause = { ...whereClause, role: { [Op.like]: `%${role}%` } };
		}
		if (joiningDate) {
			whereClause = { ...whereClause, joiningDate: { [Op.like]: `%${joiningDate}%` } };
		}
		if (skills) {
			whereClause = { ...whereClause, skills: { [Op.like]: `%${skills}%` } };
		}
		if (idUsers) {
			whereClause = { ...whereClause, idUsers: { [Op.like]: `%${idUsers}%` } };
		}

		if (disability) {
			whereClause = { ...whereClause, disability: { [Op.like]: `%${disability}%` } };
		}

		const limit = pageSize ? parseInt(pageSize as string) : 10;
		const offset = page ? (parseInt(page as string) - 1) * limit : 0;
		try {
			const result = await User.findAndCountAll({
				where: whereClause,
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

				}],
				limit,
				offset,
				order: [[orderBy as string, orderType === 'desc' ? 'DESC' : 'ASC']],
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
