import NotificationQueue from "@/models/NotificationQueue";
import { NotificationQueueModel } from "@/models/NotificationQueue";
import NotificationTemplate from "@/models/NotificationTemplate";
import { Op } from "sequelize";
import { User } from "@/models/__associations";
import { UserModel } from "@/models/User";
import AppFcmToken from "@/models/AppFcmToken";
import fs from 'fs';
import sendSms from "@/utils/SendSms";
import sendNotif, { sendNotificationToTopic } from "@/config/fcm";
import sendEmail from "@/utils/SendEmail";
import path from "path";
import ejs from 'ejs';
import { hasTemplate, renderTemplate } from '@/notifications/templates';

// Picks notifications from the queue and sends them
const runNotificationQueue = async () => {
    const unsentNotifications = await NotificationQueue.findAll({
        where: {
            status: ['pending', 'failed'],
            sendOn: {
                [Op.or]: {
                    [Op.lte]: new Date(),
                    [Op.eq]: null
                }
            },
            attempt: {
                [Op.lte]: 3 // Try sending the notification 3 times at most
            }
        }
    });

    console.log('________Queue starts at :' + (new Date()).toUTCString(), "Unsent notification: " + unsentNotifications.length);

    unsentNotifications.forEach(async (notification) => {
        // Send the notification
        console.log('Sending notification', notification.idNotificationQueue);
        notification.status = 'started';
        await notification.save();

        if (notification.notificationType === 'sms') {
            handleSmsNotification(notification);
        } else if (notification.notificationType === 'push') {
            handlePushNotification(notification);
        } else if (notification.notificationType === 'email') {
            handleEmailNotification(notification);
        }
    });
};

// Handle SMS notification sending
// For manual notifications receiver will be null and message will be sent to everyone
const handleSmsNotification = async (notification: NotificationQueueModel) => {
    const response: string[] = [];
    if (notification.receiver === null) {
        const users = await User.findAll({ where: { status: 'active', phoneNumber: { [Op.not]: null }, phoneVerified: "yes" } });
        for (var i = 0; i < users.length; i++) {
            response.push(await sendSms(notification.notificationBody!, users[i].phoneNumber!) as string);
        }
    }

    if (typeof notification.receiver === 'string') {
        // Send SMS to single user
        response.push(await sendSms(notification.notificationBody!, notification.receiver) as string);
    }

    notification.response = JSON.stringify(response);
    notification.status = 'completed';
    notification.attempt = notification.attempt + 1;
    await notification.save();
}

// Handle push notification sending
// For manual notifications receiver will be null and message will be sent to everyone via topic
const handlePushNotification = async (notification: NotificationQueueModel) => {
    const response: any[] = [];
    const notificationBody = JSON.parse(notification.notificationBody!);
    if (notification.receiver === null) {
        response.push(await sendNotificationToTopic('SAATHI_APP_IOS_PROD', notificationBody.title, notificationBody.body));
        response.push(await sendNotificationToTopic('SAATHI_APP_IOS_TEST', notificationBody.title, notificationBody.body));
        response.push(await sendNotificationToTopic('SAATHI_APP_ANDROID_PROD', notificationBody.title, notificationBody.body));
        response.push(await sendNotificationToTopic('SAATHI_APP_ANDROID_TEST', notificationBody.title, notificationBody.body));
    }

    if (typeof notification.receiver === 'string') {
        const fcmTokens = await AppFcmToken.findAll({ where: { idUsers: notification.receiver } });
        fcmTokens.forEach(async (token) => {
            response.push(await sendNotif(token.fcmToken, notificationBody.title, notificationBody.body));
        });
    }

    notification.response = JSON.stringify(response);
    notification.status = 'completed';
    notification.attempt = notification.attempt + 1;
    await notification.save();
}

//handle email notification sending
// For manual notifications receiver will be null and message will be sent to every email as bcc
const handleEmailNotification = async (notification: NotificationQueueModel) => {
    const response: any[] = [];
    if (notification.receiver === null) {
        // Send email to everyone
        const users = await User.findAll({ where: { status: 'active', email: { [Op.not]: null }, emailVerified: "yes" } });

        const notificationBody = JSON.parse(notification.notificationBody!);
        for (var i = 0; i < users.length; i++) {
            response.push(await sendEmail({
                from: 'Shathi Msg <msg@notification.n.digigramventures.com>',
                to: [users[i].email!],
                subject: notificationBody.subject,
                htmlBody: notificationBody.body,
                textBody: notificationBody.text
            }))
        }
    }

    if (typeof notification.receiver === 'string') {
        const notificationBody = JSON.parse(notification.notificationBody!);
        response.push(await sendEmail({
            from: 'Shathi Msg <msg@notification.n.digigramventures.com>',
            to: [notification.receiver],
            subject: notificationBody.subject,
            htmlBody: notificationBody.body,
            textBody: notificationBody.text
        }));
    }

    notification.response = JSON.stringify(response);
    notification.status = 'completed';
    notification.attempt = notification.attempt + 1;
    await notification.save();
}

export function generateNotificationBody(template: string, data: any, isEjs: boolean = false) {
    if (isEjs) {
        return ejs.render(template, data);
    }
    // Get the template
    var templateResult = '';
    eval(`templateResult = \`${template}\``);
    return templateResult;
}

//Generates the notification data and save it to the notification queue
export async function generateNotification(notificationName: string, notificationData: any, receiver: UserModel) {
    try {

        const notificationTemplate = await NotificationTemplate.findOne({ where: { notificationName } });

        if (!notificationTemplate) { console.error(`Notification template for ${notificationName} not found`); return; }

        if (notificationTemplate?.smsTemplate && receiver.phoneNumber && receiver.phoneVerified === 'yes') {
            await NotificationQueue.create({
                notificationType: 'sms',
                receiver: receiver.phoneNumber,
                notificationBody: generateNotificationBody(notificationTemplate.smsTemplate, notificationData)
            });
        }

        if (notificationTemplate?.pushNotificationTemplate) {
            console.log(notificationTemplate);
            const fcmTokens = await AppFcmToken.findAll({ where: { idUsers: receiver.idUsers } });
            fcmTokens.forEach(async (token) => {
                await NotificationQueue.create({
                    notificationType: 'push',
                    receiver: receiver.idUsers,
                    notificationBody: JSON.stringify({
                        title: notificationTemplate.pushNotificationTitle,
                        body: generateNotificationBody(notificationTemplate.pushNotificationTemplate!, notificationData)
                    })
                });
            });
        }

        if (notificationTemplate?.emailTemplate && receiver.email && receiver.emailVerified === 'yes') {
            /*
             * Rendered from `notifications/templates.ts` when a renderer exists
             * for this notification, and from the old .html/.ejs file otherwise.
             *
             * Both paths are kept on purpose. The rewritten templates cover the
             * eleven notifications that exist today; if a twelfth is added to
             * `notification_templates` with only a file behind it, it still
             * sends rather than silently going nowhere.
             *
             * The file path is `eval()`-based and unescaped — see
             * `generateNotificationBody`. That is the reason to migrate the
             * remainder, not to extend it.
             */
            let subject: string;
            let body: string;
            let text: string | undefined;

            if (hasTemplate(notificationName)) {
                // NULL means never asked, and is treated as English — which is
                // what all existing accounts have been receiving.
                const locale = receiver.preferredLanguage === 'bn' ? 'bn' : 'en';
                const rendered = renderTemplate(notificationName, notificationData, locale);
                subject = rendered.subject;
                body = rendered.html;
                text = rendered.text;
            } else {
                const filePath = path.join(process.cwd(), 'src', 'notifications', 'email_templates', notificationTemplate.emailTemplate);
                const emailBody = fs.readFileSync(filePath, 'utf8');
                subject = generateNotificationBody(notificationTemplate.emailSubject!, notificationData);
                body = generateNotificationBody(emailBody, notificationData, filePath.endsWith('.ejs'));
            }

            await NotificationQueue.create({
                notificationType: 'email',
                receiver: receiver.email,
                notificationBody: JSON.stringify({ subject, body, text })
            });
        }

    } catch (error) {
        console.error('Error generating notification', error);
    }
}

let notificationQueueRunning = false;
export default function init() {
    console.log('Notification service started');
    if (!notificationQueueRunning) {
        notificationQueueRunning = true;
        setInterval(() => { runNotificationQueue() }, 1000 * 30); // Every 30 seconds
    }
}
