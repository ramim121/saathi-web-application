import { NextApiRequest, NextApiResponse } from 'next'
import { District } from '@/models/__associations';
import { Division } from '@/models/__associations';
import { PoliceStation } from '@/models/__associations';

import Cors from 'micro-cors';

const cors = Cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS', 'PUT'],
    allowHeaders: ['X-Requested-With', 'Authorization', 'Content-Type'],
});


async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    const { idDivisions } = req.query;

    let districtsQuery = District.findAll({
        include: [{
            model: Division,
            required: true
        }],
        where: idDivisions ? {
            idDivisions: idDivisions
        } : {}
    });

    const districts = await districtsQuery;

    res.status(200).json(districts);
}


export default cors(handler as any);