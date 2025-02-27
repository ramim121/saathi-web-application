import { NextApiRequest, NextApiResponse } from 'next';
import { Unit } from '@/models/__associations';
import Joi from 'joi';
import sequelize from '@/config/db';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '@/config/constants';
import JWTPayload from '@/types/JWTPayload';


const schema = Joi.object({
	unitName: Joi.string().required().messages({
		"any.required": "Unit name is required",
		"string.empty": "Unit name can not be empty",
	}),
	unitCode: Joi.string().required().messages({
		"any.required": "Unit code is required",
		"string.empty": "Unit code can not be empty",
	})
}).unknown();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
	if (req.method === 'POST') {
		let tokenData = req.headers.authorization;
		let token = tokenData?.split(' ')[1];

		if (!token || jwt.verify(token, JWT_SECRET) === null) { res.status(401).json({ success: false, message: 'Invalid token' }); return; }

		let userInfo = jwt.decode(token) as JWTPayload;
		if (userInfo.userType !== 'admin') { res.status(403).json({ success: false, message: 'Access denied' }); return; }

		const { unitName, unitCode } = req.body
		const options = {
			abortEarly: false,
		};

		const { error } = schema.validate({ unitName, unitCode }, options);

		if (error) {
			let errorMessage: string[] = [];

			error.details.forEach((e) => {
				errorMessage.push(e.message);
			});
			return res.status(400).json({ success: false, message: errorMessage.join(". <br>") });
		}

		const unitNameExists = await Unit.findOne({ where: { unitName } });

		if (unitNameExists) {
			return res.status(400).json({ success: false, message: 'Unit name already exists' })
		}

		const unitCodeExists = await Unit.findOne({ where: { unitCode } });

		if (unitCodeExists) {
			return res.status(400).json({ success: false, message: 'Unit code already exists' })
		}

		const transaction = await sequelize.transaction();

		try {
			const unit = await Unit.create({
				unitName,
				unitCode
			}, { transaction })
			await transaction.commit();

			return res.status(200).json({ success: true, message: 'Unit created successfully', data: unit })
		} catch (err) {
			await transaction.rollback();
			return res.status(400).json({ success: false, message: (err as Error).message })
		}
	} else {
		res.status(405).json({ success: false, message: 'Method not allowed' })
	}
}