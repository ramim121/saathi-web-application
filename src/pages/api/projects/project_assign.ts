import { NextApiRequest, NextApiResponse } from 'next';
import { ProjectPartner, Project } from '@/models/__associations';
import Joi from 'joi';
import sequelize from '@/config/db';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '@/config/constants';
import JWTPayload from '@/types/JWTPayload';

const schema = Joi.object({
    project: Joi.number().required().messages({
        'any.required': 'Project is required',
        'number.base': 'Project must be selected'
    }),
    partners: Joi.array()
        .items(
            Joi.object({
                partner: Joi.number().required().messages({
                    'any.required': 'Partner is required',
                    'number.base': 'Partner must be selected'
                }),
                partnerUnitCapacity: Joi.number().greater(0).required().messages({
                    'any.required': 'Partner unit capacity is required',
                    'number.base': 'Partner unit capacity must be a number',
                    'number.greater': 'Partner unit capacity must be greater than 0'
                })
            })
        )
        .min(1)
        .required()
        .messages({
            'any.required': 'At least one partner is required',
            'array.min': 'At least one partner is required'
        })
}).unknown();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        res.status(405).json({ success: false, message: 'Method not allowed' });
        return;
    }

    const tokenData = req.headers.authorization;
    const token = tokenData?.split(' ')[1];

    if (!token || jwt.verify(token, JWT_SECRET) === null) {
        res.status(401).json({ success: false, message: 'Invalid token' });
        return;
    }

    const userInfo = jwt.decode(token) as JWTPayload;
    if (userInfo.userType !== 'admin') {
        res.status(403).json({ success: false, message: 'Access denied' });
        return;
    }

    const { project, partners } = req.body;
    const options = { abortEarly: false };
    const { error } = schema.validate({ project, partners }, options);
    if (error) {
        const errorMessage: string[] = [];
        error.details.forEach((e) => {
            errorMessage.push(e.message);
        });
        res.status(400).json({ success: false, message: errorMessage.join('. <br>') });
        return;
    }

    const duplicatePartnerIds = new Set<number>();
    const seenPartnerIds = new Set<number>();
    partners.forEach((item: { partner: number }) => {
        if (seenPartnerIds.has(item.partner)) {
            duplicatePartnerIds.add(item.partner);
            return;
        }
        seenPartnerIds.add(item.partner);
    });

    if (duplicatePartnerIds.size > 0) {
        res.status(400).json({ success: false, message: 'Duplicate partners are not allowed in one request' });
        return;
    }

    const transaction = await sequelize.transaction();
    try {
        const projectDetails = await Project.findOne({
            where: { idProjects: project },
            transaction
        });
        if (!projectDetails) {
            await transaction.rollback();
            res.status(404).json({ success: false, message: 'Project not found' });
            return;
        }

        const existingRelations = await ProjectPartner.findAll({
            where: {
                idProjects: project
            },
            attributes: ['idUsers'],
            transaction
        });
        const existingPartnerIds = new Set(existingRelations.map((item) => item.idUsers));
        const alreadyAssignedPartners = partners
            .filter((item: { partner: number }) => existingPartnerIds.has(item.partner))
            .map((item: { partner: number }) => item.partner);

        if (alreadyAssignedPartners.length > 0) {
            await transaction.rollback();
            res.status(400).json({
                success: false,
                message: `Some partners are already assigned to this project: ${alreadyAssignedPartners.join(', ')}`
            });
            return;
        }

        const payload = partners.map((item: { partner: number; partnerUnitCapacity: number }) => ({
            idProjects: project,
            idUsers: item.partner,
            partnerUnitCapacity: item.partnerUnitCapacity
        }));

        const projectPartners = await ProjectPartner.bulkCreate(payload, { transaction });

        const totalAddedCapacity = partners.reduce(
            (sum: number, item: { partnerUnitCapacity: number }) => sum + Number(item.partnerUnitCapacity),
            0
        );
        await Project.update(
            { totalAvailableUnits: projectDetails.totalAvailableUnits + totalAddedCapacity },
            { where: { idProjects: project }, transaction }
        );

        await transaction.commit();
        res.status(200).json({
            success: true,
            message: 'Partners assigned successfully',
            data: projectPartners
        });
    } catch (err) {
        await transaction.rollback();
        res.status(400).json({ success: false, message: (err as Error).message });
    }
}
