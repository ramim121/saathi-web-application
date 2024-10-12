import { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '@/config/constants';
import bcrypt from 'bcrypt';
import { User, ProjectInvestor, ProjectPartner, Project } from '@/models/__associations';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if(req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    if (req.method === 'POST') {
        const { email, password } = req.body

        // Check if username and password are provided
        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email and password are required' })
        }

        try {
            // Find the user with the provided username
            const user = await User.scope('withPassword').findOne({
                where: { email, userType: 'admin' },
                include: [
                    { model: ProjectInvestor, as: 'Investments', include: [Project] },
                    { model: ProjectPartner, as: 'Partnerships', include: [Project] }
                ],
            })

            // If the user is not found, return a 404 Not Found response
            if (!user) {
                return res.status(404).json({ success: false, message: 'User not found' })
            }

            // Verify the password
            const passwordMatch = await bcrypt.compare(password, user.password)

            if (!passwordMatch) {
                return res.status(401).json({ success: false, message: 'Invalid email or password' })
            }


            // Generate a JWT token
            const token = jwt.sign({ idUsers: user.idUsers, userType: user.userType }, JWT_SECRET, {
                expiresIn: '30d',
            })

            return res.status(200).json({ success: true, token, user })
        } catch (err: any) {
            console.error(err)
            return res.status(500).json({ success: false, message: err.message })
        }
    } else {
        res.status(405).json({ success: false, message: 'Method not allowed' })
    }
}