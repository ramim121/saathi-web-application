import ManualNotification from "@/models/ManualNotification";
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

const runNotifications = async () => {
    const unsentNotifications = await NotificationQueue.findAll({
        where: {
            status: ['pending', 'failed'],
            sendOn: {
                [Op.lte]: new Date()
            },
            attempt: {
                [Op.lte]: 3 // Try sending the notification 3 times at most
            }
        },
        include: [
            {
                model: ManualNotification,
                include: [
                    {
                        model: NotificationTemplate
                    }
                ]
            }
        ]
    });

    unsentNotifications.forEach(async (notification) => {
        // Send the notification
        console.log('Sending notification', notification.idNotificationQueue);

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

const handlePushNotification = async (notification: NotificationQueueModel) => {
    const response: any[] = [];
    const notificationBody = JSON.parse(notification.notificationBody!);
    if (notification.receiver === null) {
        response.push(await sendNotificationToTopic('all', notificationBody.title, notificationBody.body));
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

const handleEmailNotification = async (notification: NotificationQueueModel) => {
    const response: any[] = [];
    if (notification.receiver === null) {
        // Send email to everyone
        const users = await User.findAll({ where: { status: 'active', email: { [Op.not]: null }, emailVerified: "yes" } });

        const notificationBody = JSON.parse(notification.notificationBody!);
        response.push(await sendEmail({
            from: 'notification@digigramventures.com',
            to: users.map(user => user.email!),
            subject: notificationBody.subject,
            htmlBody: notificationBody.body
        }))
    }

    if (typeof notification.receiver === 'string') {
        const notificationBody = JSON.parse(notification.notificationBody!);
        response.push(await sendEmail({
            from: 'notification@digigramventures.com',
            to: [notification.receiver],
            subject: notificationBody.subject,
            htmlBody: notificationBody.body
        }));
    }

    notification.response = JSON.stringify(response);
    notification.status = 'completed';
    notification.attempt = notification.attempt + 1;
    await notification.save();
}

export function generateNotificationBody(template: string, data: any) {
    // Get the template
    eval(`var template = \`${template}\``);
    return template;
}

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
            const fcmTokens = await AppFcmToken.findAll({ where: { idUsers: receiver.idUsers } });
            fcmTokens.forEach(async (token) => {
                await NotificationQueue.create({
                    notificationType: 'push',
                    receiver: token.fcmToken,
                    notificationBody: JSON.stringify({
                        title: notificationTemplate.pushNotificationTitle,
                        body: generateNotificationBody(notificationTemplate.pushNotificationTemplate!, notificationData)
                    })
                });
            });
        }

        if (notificationTemplate?.emailTemplate && receiver.email && receiver.emailVerified === 'yes') {
            // Open email template file
            const emailBody = fs.readFileSync(`./email-templates/${notificationTemplate.emailTemplate}`, 'utf8');
            await NotificationQueue.create({
                notificationType: 'email',
                receiver: receiver.email,
                notificationBody: JSON.stringify({
                    subject: notificationTemplate.emailSubject,
                    body: generateNotificationBody(emailBody, notificationData)
                })
            });
        }

    } catch (error) {
        console.error('Error generating notification', error);
    }
}

setInterval(runNotifications, 1000 * 30); // Every 30 seconds