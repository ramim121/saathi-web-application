import { Optional } from 'sequelize';

export default interface NotificationTemplate {
    idNotificationTemplates: number;
    notificationName: string | null;
    smsTemplate: string | null;
    emailSubject: string | null;
    emailTemplate: string | null;
    pushNotificationTitle: string | null;
    pushNotificationTemplate: string | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface NotificationTemplatesAttributes extends Optional<NotificationTemplate, 'idNotificationTemplates'> { }