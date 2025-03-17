import { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import JWTPayload from '@/types/JWTPayload';
import { JWT_SECRET } from '@/config/constants';
import { User, Project, ProjectInvestor, ProjectPartner, UserBank, Bank, BankBranch, UserAddress, Division, District, PoliceStation } from '@/models/__associations';
import Joi from 'joi';
import Cors from 'micro-cors';
import Sequelize from 'sequelize';
import { Op } from 'sequelize';
import to from 'await-to-js';
const cors = Cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE'],
    allowHeaders: ['X-Requested-With', 'Authorization', 'Content-Type'],
});

const addressCreateSchema = Joi.object({
    addressLine1: Joi.string().required().messages({
        "any.required": "Address line 1 is required",
        "string.empty": "Address line 1 can not be empty",
    }),
    addressLine2: Joi.string().allow(null, ''),
    idDistricts: Joi.number().required().messages({
        "any.required": "District is required",
    }),
    idDivisions: Joi.number().required().messages({
        "any.required": "Division is required",
    }),
    idPoliceStations: Joi.number().required().messages({
        "any.required": "Police station is required",
    }),
    insideDhaka: Joi.string().valid('yes', 'no').required().messages({
        "any.required": "Inside Dhaka is required",
        "string.empty": "Inside Dhaka can not be empty",
    }),
    postalCode: Joi.string().allow(null, ''),
    phone: Joi.string().required().messages({
        "any.required": "Phone number is required",
        "string.empty": "Phone number can not be empty",
    }),
});

const addressUpdateSchema = Joi.object({
    addressLine1: Joi.string().required().messages({
        "any.required": "Address line 1 is required",
        "string.empty": "Address line 1 can not be empty",
    }),
    addressLine2: Joi.string().allow(null, ''),
    idDistricts: Joi.number().required().messages({
        "any.required": "District is required",
    }),
    idDivisions: Joi.number().required().messages({
        "any.required": "Division is required",
    }),
    idPoliceStations: Joi.number().required().messages({
        "any.required": "Police station is required",
    }),
    insideDhaka: Joi.string().valid('yes', 'no').required().messages({
        "any.required": "Inside Dhaka is required",
        "string.empty": "Inside Dhaka can not be empty",
    }),
    postalCode: Joi.string().allow(null, ''),
    phone: Joi.string().required().messages({
        "any.required": "Phone number is required",
        "string.empty": "Phone number can not be empty",
    }),
    idUserAddresses: Joi.number().required().messages({
        "any.required": "Address ID is required",
    }),
});

async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'OPTIONS') { return res.status(200).end(); }
    let tokenData = req.headers.authorization;
    let token = tokenData?.split(' ')[1];

    if (!token) { res.status(401).json({ success: false, message: 'Token not found' }); return; }
    try { jwt.verify(token, JWT_SECRET) } catch (e: any) { res.status(401).json({ success: false, message: e.message }); return; }

    let userInfo = jwt.decode(token) as JWTPayload;
    const user = await User.findByPk(userInfo!.idUsers);

    if (!user) { res.status(404).json({ message: 'User not found' }); return; }

    if (req.method == 'GET') {
        const userAddresses = await UserAddress.findAll({
            include: [Division, District, PoliceStation],
            where: {
                idUsers: userInfo!.idUsers
            }
        });

        res.status(200).json({ addresses: userAddresses }); return;
    }

    if (req.method == 'PUT') {
        const { error } = addressUpdateSchema.validate(req.body, { abortEarly: false });
        if (error) {
            let errorMessage: string[] = [];
            error.details.forEach((e) => {
                errorMessage.push(e.message);
            });
            return res.status(400).json({ success: false, message: errorMessage });
        }

        const existingAddress = await UserAddress.findByPk(req.body.idUserAddresses);
        if (!existingAddress) { res.status(404).json({ success: false, message: 'Address not found' }); return; }

        const updatedUserAddress = await UserAddress.update(req.body, {
            where: {
                idUserAddresses: req.body.idUserAddresses
            }
        });

        res.status(200).json({ success: true, address: updatedUserAddress, message: 'User Address updated successfully' });
        return;
    }

    if (req.method == 'POST') {
        const { error } = addressCreateSchema.validate(req.body, { abortEarly: false });
        if (error) {
            let errorMessage: string[] = [];
            error.details.forEach((e) => {
                errorMessage.push(e.message);
            });
            return res.status(400).json({ success: false, message: errorMessage });
        }

        const newUserAddress = await UserAddress.create({
            ...req.body,
            idUsers: userInfo!.idUsers
        });

        res.status(200).json({ success: true, address: newUserAddress, message: 'User Address created successfully' });
        return;
    }

    if (req.method == 'DELETE') {
        const { idUserAddresses } = req.body;
        if (!idUserAddresses) { res.status(400).json({ success: false, message: 'Address ID is required' }); return; }

        const existingAddress = await UserAddress.findByPk(idUserAddresses);
        if (!existingAddress) { res.status(404).json({ success: false, message: 'Address not found' }); return; }

        const [err, result] = await to(UserAddress.destroy({
            where: {
                idUserAddresses: idUserAddresses
            }
        }));

        if (err) { res.status(500).json({ success: false, message: err.message }); return; }

        res.status(200).json({ success: true, message: 'User Address deleted successfully' });
        return;
    }
}

export default cors(handler as any);