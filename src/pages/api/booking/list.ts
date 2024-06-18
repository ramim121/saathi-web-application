import { NextApiRequest, NextApiResponse } from 'next'
import { ProjectInvestor, Project, ProjectPartnerInvestor, User, ProjectPartner } from '@/models/__associations'
import { Sequelize } from 'sequelize'

export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse
): Promise<void> {
	if (req.method === 'GET') {
		try {

			const result = await ProjectInvestor.findAll({
				attributes: [
					'idProjectInvestors',
					'investmentStatus',
					'investmentDate',
					'unitPurchased'],
				include: [
					{
						model: Project,
						attributes: ['projectName', 'location'],

					},
					{
						model: User,
						attributes: ['fullName']
					},
					{
						model: ProjectPartnerInvestor,
						include: [
							{
								model: ProjectPartner,
								include: [
									{
										model: User,
										attributes: ['fullName']
									}
								]
							}
						]
					},
				],
			})

			for (let i = 0; i < result.length; i++) {
				let totalInvestedAmount = 0;
				if (result[i].ProjectPartnerInvestors) {
					for (let j = 0; j < result[i].ProjectPartnerInvestors.length; j++) {
						totalInvestedAmount += Number(result[i].ProjectPartnerInvestors[j].amountInvested);
					}
				}
				result[i].dataValues.totalInvestedAmount = totalInvestedAmount;
			}



			return res.status(200).json({ success: true, data: result })
		} catch (error) {
			return res.status(500).json({ success: false, message: (error as Error).message })
		}
	} else {
		res.status(405).json({ success: false, message: 'Method not allowed' })
	}
}