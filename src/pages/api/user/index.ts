import { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import JWTPayload from '@/types/JWTPayload';
import { JWT_SECRET } from '@/config/constants';
import { User, Project, ProjectInvestor, ProjectPartner, UserBank, Bank, BankBranch } from '@/models/__associations';
import Joi from 'joi';
import Cors from 'micro-cors';
import Sequelize from 'sequelize';
import { Op } from 'sequelize';
const cors = Cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS', 'PUT'],
    allowHeaders: ['X-Requested-With', 'Authorization', 'Content-Type'],
});

const schema = Joi.object({
    fullName: Joi.string().required().messages({
        "any.required": "Name is required",
        "string.empty": "Name can not be empty",
    }),
    email: Joi.string().email().messages({
        "string.email": "Invalid email",
    }),
    dateOfBirth: Joi.date().required().messages({
        "any.required": "Date of birth is required",
        "date.base": "Date of birth must be a date",
    }),
}).unknown();

async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'OPTIONS') { return res.status(200).end(); }

    let tokenData = req.headers.authorization;
    let token = tokenData?.split(' ')[1];

    if (!token) { res.status(401).json({ success: false, message: 'Token not found' }); return; }
    try { jwt.verify(token, JWT_SECRET) } catch (e: any) { res.status(401).json({ success: false, message: e.message }); return; }

    let userInfo = jwt.decode(token) as JWTPayload;
    const user = await User.findByPk(userInfo!.idUsers,
        {
            include: [
                { model: ProjectInvestor, as: 'Investments', include: [Project] },
                { model: ProjectPartner, as: 'Partnerships', include: [Project] },
                { model: UserBank, include: [Bank, BankBranch] },
            ],
        })

    if (!user) { res.status(404).json({ message: 'User not found' }); return; }
    if (req.method == 'GET') { res.status(200).json({ user }); return; }
    if (req.method == 'PUT') {
        const { error } = schema.validate(req.body, { abortEarly: false });
        if (error) {
            let errorMessage: string[] = [];
            error.details.forEach((e) => {
                errorMessage.push(e.message);
            });
            return res.status(400).json({ success: false, message: errorMessage });
        }

        const existingEmail = await User.findOne({
            where: {
                [Op.and]: [
                    Sequelize.where(Sequelize.fn('LOWER', Sequelize.col('email')), Sequelize.fn('LOWER', req.body.email)),
                    {
                        idUsers: {
                            [Op.not]: userInfo!.idUsers
                        }
                    }
                ]
            }
        });
        if (existingEmail) {
            return res.status(400).json({ success: false, message: 'Email already exists' });
        }

        let { fullName, email, dateOfBirth } = req.body
        let updatedUser = await User.update({ fullName, email, dateOfBirth }, { where: { idUsers: userInfo!.idUsers } });
        res.status(200).json({ updatedUser });
    }
}

export default cors(handler as any);