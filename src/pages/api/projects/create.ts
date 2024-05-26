import { NextApiRequest, NextApiResponse } from 'next';
import { Project } from '@/models/__associations';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'POST') {
        const { projectName, unitInvestmentValue, investment, summary, location } = req.body

        try {
            const data = await Project.create({
                projectName,
                summary,
                returnRangeMin: investment.minimumReturn !== undefined ? investment.minimumReturn : 0,
                returnRangeMax: investment.maximumReturn !== undefined ? investment.maximumReturn : 0,
                returnType: investment.type,
                duration: investment.duration,
                tenure: investment.tenure,
                location,
                unitInvestmentValue
            })

            return res.status(200).json({ data })
        } catch (err: any) {
            console.error(err)
            return res.status(500).json({ message: err.message })
        }
    } else {
        res.status(405).json({ message: 'Method not allowed' })
    }
}