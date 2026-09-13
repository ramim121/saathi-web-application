import { NextApiRequest, NextApiResponse } from 'next';
import Cors from 'micro-cors';
import _ from 'await-to-js';
import Joi from 'joi';
import ContactForm from '@/models/ContactMessage';

const cors = Cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'OPTIONS', 'PUT'],
    allowHeaders: ['X-Requested-With', 'Authorization', 'Content-Type'],
});

const schema = Joi.object({
    name: Joi.string().required(),
    email: Joi.string().email().required(),
    subject: Joi.string().required(),
    message: Joi.string().required(),
});

const options = {
    abortEarly: false,
};

async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'OPTIONS') { return res.status(200).end(); }
    if (req.method === 'POST') {
        const { name, email, message } = req.body;

        const { error } = schema.validate(req.body, options);

        if (error) {
            let errorMessage: string[] = [];

            error.details.forEach((e) => {
                errorMessage.push(e.message);
            });
            return res.status(400).json({ success: false, message: errorMessage.join(". <br>") });
        }

        let [err, result] = await _(ContactForm.create(req.body));
        if (err) { return res.status(400).json({ success: false, message: err.message }); }

        // Send email to the admin
        return res.status(200).json({ success: true, message: 'Message sent successfully' });
    }
}

export default cors(handler as any);