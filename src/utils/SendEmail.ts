import { SESClient, SendEmailCommand, SendEmailCommandInput, SendEmailCommandOutput } from "@aws-sdk/client-ses";
import { SES_AWS_REGION, SES_AWS_ACCESS_KEY_ID, SES_AWS_SECRET_ACCESS_KEY } from "@/config/constants";

interface EmailOptions {
    from: string;
    to: string[];
    subject: string;
    htmlBody: string;
    textBody?: string;
}

const sesClient = new SESClient({
    region: SES_AWS_REGION,
    credentials: {
        accessKeyId: SES_AWS_ACCESS_KEY_ID,
        secretAccessKey: SES_AWS_SECRET_ACCESS_KEY
    }
});

async function sendEmail(options: EmailOptions): Promise<SendEmailCommandOutput> {
    // Validate email options
    if (!options.from || options.to.length === 0) {
        throw new Error('From address and at least one recipient are required');
    }

    try {
        console.log('Sending email:', options.to);
        // Prepare email command input
        const params: SendEmailCommandInput = {
            Source: options.from,
            Destination: {
                ToAddresses: [options.to[0]],
            },
            Message: {
                Subject: {
                    Data: options.subject,
                    Charset: 'UTF-8'
                },
                Body: {
                    Html: {
                        Data: options.htmlBody,
                        Charset: 'UTF-8'
                    },
                    Text: {
                        Data: options.textBody || '',
                        Charset: 'UTF-8'
                    }
                }
            }
        };

        // Send the email
        const command = new SendEmailCommand(params);
        const response = await sesClient.send(command);

        return response;
    } catch (error: any) {
        console.error('Error sending email:', error);
        return error;
    }
}


export default sendEmail;