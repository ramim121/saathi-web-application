import fetch from 'node-fetch';
import { BULK_SMS_SENDER_ID, BULK_SMS_API_KEY } from '@/config/constants';
import { allowSms } from '@/utils/notifySandbox';

export default async function sendSms(message: string, receiver: string) {
    // On a sandboxed server (NOTIFY_ALLOWLIST set), only listed numbers get SMS.
    const number = allowSms(receiver);
    if (!number) return false;

    const url = "http://bulksmsbd.net/api/smsapi";
    const apiKey = BULK_SMS_API_KEY;
    const senderid = BULK_SMS_SENDER_ID;
    const data = {
        api_key: apiKey,
        senderid: senderid,
        number,
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
        console.log(responseData);
        return responseData;
    } else {
        console.log(response.status);
        return false;
    }
}
