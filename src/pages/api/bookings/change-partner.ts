import { NextApiRequest, NextApiResponse } from 'next';
import { ProjectInvestor, ProjectPartnerInvestor, ProjectPartner } from '@/models/__associations';
import { lockProjects } from '@/utils/partnerCapacity';
import sequelize from '@/config/db';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '@/config/constants';
import JWTPayload from '@/types/JWTPayload';
import Joi from 'joi';
import Cors from 'micro-cors';
import { Op } from 'sequelize';

const cors = Cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS', 'PUT'],
    allowHeaders: ['X-Requested-With', 'Authorization', 'Content-Type'],
});

const schema = Joi.object({
    idProjectPartnerInvestors: Joi.number().min(0).required().messages({
        "any.required": "Project partner investor is required",
        "number.base": "Project partner investor is required",
        "number.min": "Project partner investor is required",
    }),
    idProjectPartners: Joi.number().min(0).required().messages({
        "any.required": "Project partner is required",
        "number.base": "Project partner is required",
        "number.min": "Project partner is required",
    }),
    idProjects: Joi.number().min(0).required().messages({
        "any.required": "Project is required",
        "number.base": "Project is required",
        "number.min": "Project is required",
    }),

}).unknown();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'PUT') {
        let tokenData = req.headers.authorization;
        let token = tokenData?.split(' ')[1];

        if (!token || jwt.verify(token, JWT_SECRET) === null) { res.status(401).json({ success: false, message: 'Invalid token' }); return; }

        let userInfo = jwt.decode(token) as JWTPayload;
        if (userInfo.userType !== 'admin') { res.status(403).json({ success: false, message: 'Access denied' }); return; }

        const { idProjectPartnerInvestors, idProjectPartners, idProjects } = req.body

        const options = {
            abortEarly: false,
        };
        const { error } = schema.validate({ idProjectPartnerInvestors, idProjectPartners, idProjects }, options);
        if (error) {
            let errorMessage: string[] = [];

            error.details.forEach((e) => {
                errorMessage.push(e.message);
            });
            return res.status(400).json({ success: false, message: errorMessage.join(". <br>") });
        }

        const transaction = await sequelize.transaction();
        try {
            const booking = await ProjectPartnerInvestor.findOne({
                where: { idProjectPartnerInvestors },
                transaction,
            });
            if (!booking) {
                await transaction.rollback();
                return res.status(400).json({ success: false, message: 'Booking not found' });
            }

            const line = await ProjectInvestor.findByPk(booking.idProjectInvestors as number, {
                attributes: ['idProjects', 'investmentStatus'],
                transaction,
            });
            if (!line) {
                await transaction.rollback();
                return res.status(400).json({ success: false, message: 'Investment not found' });
            }
            await lockProjects([Number(line.idProjects)], transaction);

            const partnerInfo = await ProjectPartner.findOne({
                where: { idProjectPartners },
                attributes: ['idProjects', 'partnerUnitCapacity'],
                transaction,
            });
            // Moving units to a partner on another project mis-files the investor's money.
            if (!partnerInfo || Number(partnerInfo.idProjects) !== Number(line.idProjects)) {
                await transaction.rollback();
                return res.status(400).json({ success: false, message: 'That partner is not on this project.' });
            }

            // Only money that is live uses capacity; history can be re-filed freely.
            const live = ['confirmed', 'booked'].includes(String(line.investmentStatus));
            if (live && Number(partnerInfo.partnerUnitCapacity) !== 0) {
                const alreadyInvested = await ProjectPartnerInvestor.sum('investedUnit', {
                    where: {
                        idProjectPartners,
                        idProjectPartnerInvestors: { [Op.not]: idProjectPartnerInvestors },
                        idProjectInvestors: {
                            [Op.in]: sequelize.literal(`(SELECT id_project_investors FROM project_investors WHERE investment_status = 'confirmed')`),
                        },
                    },
                    transaction,
                });
                const room = Number(partnerInfo.partnerUnitCapacity) - (Number(alreadyInvested) || 0);
                if (Number(booking.investedUnit) > room) {
                    await transaction.rollback();
                    return res.status(400).json({ success: false, message: `This partner has room for ${Math.max(0, room)} unit(s), and this allocation is ${booking.investedUnit}.` });
                }
            }

            await ProjectPartnerInvestor.update({ idProjectPartners }, { where: { idProjectPartnerInvestors }, transaction });
            await transaction.commit();
            return res.status(200).json({ success: true, message: 'Project partner changed successfully', data: booking })
        } catch (error) {
            await transaction.rollback();
            return res.status(400).json({ success: false, message: (error as Error).message })
        }
    } else {
        res.status(405).json({ success: false, message: 'Method not allowed' })
    }
}