import { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import JWTPayload from '@/types/JWTPayload';
import { JWT_SECRET } from '@/config/constants';
import { User, Project, ProjectInvestor, ProjectPartner } from '@/models/__associations';
import Joi from 'joi';

const schema = Joi.object({
    fullName: Joi.string().required().messages({
        "any.required": "Name is required",
        "string.empty": "Name can not be empty",
    }),
    email: Joi.string().email().required().messages({
        "any.required": "email is required",
        "string.email": "Invalid email",
    }),
    dateOfBirth: Joi.date().required().messages({
        "any.required": "Date of birth is required",
        "date.base": "Date of birth must be a date",
    }),
}).unknown();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {

    let tokenData = req.headers.authorization;
    let token = tokenData?.split(' ')[1];

    if (!token || jwt.verify(token, JWT_SECRET) === null) { res.status(401).json({ success: false, message: 'Invalid token' }); return; }

    let userInfo = jwt.decode(token) as JWTPayload;
    const user = await User.findByPk(userInfo!.idUsers,
        {
            include: [
                { model: ProjectInvestor, as: 'Investments', include: [Project] },
                { model: ProjectPartner, as: 'Partnerships', include: [Project] }
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

        let updatedUser = await User.update(req.body, { where: { idUsers: userInfo!.idUsers } });
        res.status(200).json({ updatedUser });
    }


}