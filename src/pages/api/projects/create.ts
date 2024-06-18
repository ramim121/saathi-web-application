import { NextApiRequest, NextApiResponse } from 'next';
import { Project } from '@/models/__associations';
import Joi from 'joi';
import sequelize from '@/config/db';

const schema = Joi.object({
    projectName: Joi.string().required().messages({
        "any.required": "Project name is required",
        "string.empty": "Project name can not be empty",
    }),
    unitInvestmentValue: Joi.number().min(1).required().messages({
        "any.required": "Unit investment value is required",
        "number.base": "Share/Unit must be a number",
        "number.min": "Share/Unit must be at least 1",
    }),
    location: Joi.string().required().messages({
        "any.required": "Location is required",
        "string.empty": "Location can not be empty",
    }),
    investment: Joi.object({
        minimumReturn: Joi.number().optional().messages({
            "number.base": "Minimum return must be a number",
        }),
        maximumReturn: Joi.number().optional().messages({
            "number.base": "Maximum return must be a number",
        }),
        investmentType: Joi.string().valid('high_return', 'low_return', 'short_duration', 'long_duration', 'shariah').required().empty().messages({
            "any.required": "Investment type is required",
            "any.only": "Invalid investment type",
            "string.empty": "Investment type can not be empty",
        }),
        returnType: Joi.string().valid('variable', 'fixed').required().messages({
            "any.required": "Return type is required",
            "any.only": "Invalid return type",
        }),
        duration: Joi.number().required().messages({
            "any.required": "Duration is required",
            "number.base": "Duration must be a number",
        }),
        tenure: Joi.string().required().messages({
            "any.required": "Tenure is required",
            "string.empty": "Tenure can not be empty",
        }),
        label: Joi.string().optional().messages({
            "string.empty": "Label can not be empty",
        }),
        value: Joi.number().optional().messages({
            "number.base": "Value must be a number",
        }),
    }).required().messages({
        "any.required": "Investment is required",
    }),
    totalReturnMax: Joi.number().required().messages({
        "any.required": "Total return max is required",
        "number.base": "Total return max must be a number",
    }),
    totalReturnMin: Joi.number().required().messages({
        "any.required": "Total return min is required",
        "number.base": "Total return min must be a number",
    }),
    collectionStarts: Joi.date().required().messages({
        "any.required": "Collection starts is required",
        "date.base": "Collection starts must be a date",
    }),
    collectionEnds: Joi.date().required().messages({
        "any.required": "Collection ends is required",
        "date.base": "Collection ends must be a date",
    }),
}).unknown();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'POST') {
        const { projectName, unitInvestmentValue, investment, summary, location, createdBy, totalReturnMax, totalReturnMin, collectionStarts, collectionEnds, otherLocations } = req.body
        const options = {
            abortEarly: false,
        };
        const { error } = schema.validate({ projectName, unitInvestmentValue, investment, location, createdBy, totalReturnMax, totalReturnMin, collectionStarts, collectionEnds }, options);

        if (error) {
            let errorMessage: string[] = [];

            error.details.forEach((e) => {
                errorMessage.push(e.message);
            });
            return res.status(400).json({ success: false, message: errorMessage.join(". <br>") });
        }

        const transaction = await sequelize.transaction();
        try {
            const data = await Project.create({
                projectName,
                summary,
                returnRangeMin: investment.minimumReturn !== undefined ? investment.minimumReturn : 0,
                returnRangeMax: investment.maximumReturn !== undefined ? investment.maximumReturn : 0,
                investmentType: investment.investmentType,
                returnType: investment.returnType,
                duration: investment.duration,
                tenure: investment.tenure,
                location,
                unitInvestmentValue,
                createdBy,
                totalReturnMin,
                totalReturnMax,
                collectionStarts,
                collectionEnds,
                otherLocations,
                projectStatus: 'created'
            }, { transaction });

            await transaction.commit();

            return res.status(200).json({ success: true, message: 'Project created successfully', data: data });
        } catch (err) {
            await transaction.rollback();
            return res.status(500).json({ success: false, message: (err as Error).message })
        }
    } else {
        res.status(405).json({ success: false, message: 'Method not allowed' })
    }
}