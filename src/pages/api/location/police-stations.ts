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
    const { idDistricts } = req.query;

    let policeStationsQuery = PoliceStation.findAll({
        include: [{
            model: District,
            required: true
        }],
        where: idDistricts ? {
            idDistricts: idDistricts
        } : {}
    });

    const policeStations = await policeStationsQuery;

    res.status(200).json(policeStations);
}

export default cors(handler as any);