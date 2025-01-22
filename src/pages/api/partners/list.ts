import { NextApiRequest, NextApiResponse } from 'next'
import { User, ProjectPartner, Project, File } from '@/models/__associations'
import { Op } from 'sequelize'
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '@/config/constants';
import JWTPayload from '@/types/JWTPayload';
import sequelize from '@/config/db';

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

		const { fullName, phoneNumber, age, location, role, joiningDate, skills, idUsers, disability, partnerType, orderBy, orderType, page, pageSize } = req.query

		let whereClause: { userType: string; fullName?: { [Op.like]: string }; phoneNumber?: { [Op.like]: string }; age?: { [Op.like]: string }; location?: { [Op.like]: string }; idUsers?: { [Op.like]: string }; skills?: { [Op.like]: string }; role?: { [Op.like]: string }; joiningDate?: { [Op.like]: string }; disability?: { [Op.like]: string }; partnerType?: { [Op.like]: string } } = { userType: 'partner' };

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

		if (partnerType) {
			whereClause = { ...whereClause, partnerType: { [Op.like]: `%${partnerType}%` } };
		}


		const limit = pageSize ? parseInt(pageSize as string) : 10;
		const offset = page ? (parseInt(page as string) - 1) * limit : 0;
		try {
			const result = await User.findAndCountAll({
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
					'partnerType'
				],
				include: [{
					model: ProjectPartner, as: 'Partnerships', required: false,
					attributes: [
						'partnerUnitCapacity',
						[
							sequelize.literal(`(
							SELECT IFNULL(SUM(invested_unit),0)
							FROM project_partner_investors AS ppi
							LEFT JOIN project_investors AS pi ON pi.id_project_investors = ppi.id_project_investors
							WHERE ppi.id_project_partners = Partnerships.id_project_partners and pi.investment_status = 'confirmed'
						)`),
							'alreadyInvestedUnits'
						],
					],
					include: [
						{ model: Project, as: 'Project', required: false, attributes: ['projectName', 'location'] }
					],

				},
				{ model: File, as: 'ProfilePicture', required: false }],

				where: whereClause,
				limit,
				offset,
				distinct: true,
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
			return res.status(400).json({ success: false, message: (error as Error).message })
		}
	} else {
		res.status(405).json({ success: false, message: 'Method not allowed' })
	}
}
