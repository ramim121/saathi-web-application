import { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import JWTPayload from '@/types/JWTPayload';
import { JWT_SECRET } from '@/config/constants';
import { User, Project, ProjectInvestor, ProjectPartner } from '@/models/__associations';


export default async function handler(req: NextApiRequest, res: NextApiResponse) {

    let tokenData = req.headers.authorization;
    let token = tokenData?.split(' ')[1];

    if (!token || jwt.verify(token, JWT_SECRET) === null) { res.status(401).json({ message: 'Invalid token' }); return; }

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


}