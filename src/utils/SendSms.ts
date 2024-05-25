import fetch from 'node-fetch';
import { BULK_SMS_SENDER_ID, BULK_SMS_API_KEY } from '@/config/constants';

export default async function sendSms(message: string, receiver: string) {
    const url = "http://bulksmsbd.net/api/smsapi";
    const apiKey = BULK_SMS_API_KEY;
    const senderid = BULK_SMS_SENDER_ID;
    const data = {
        api_key: apiKey,
        senderid: senderid,
        number: receiver,
        message: message
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });

    if (response.status == 202 || response.status == 200) {
        const responseData = await response.json();
        return responseData;
    } else {
        console.log(response.status);
        return false;
    }
}
