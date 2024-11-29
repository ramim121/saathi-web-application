import { Optional } from 'sequelize';

export default interface NotificationQueue {
    idNotificationQueue: number;
    notificationType: 'sms' | 'push' | 'email';
    receiver: string;
    response: string | null;
    createdAt: Date;
    updatedAt: Date;
    sendOn: Date;
    attempt: number;
    status: 'pending' | 'started' | 'failed' | 'completed' | null;
    notificationBody: string | null;
  }

export interface NotificationQueueAttributes extends Optional<NotificationQueue, 'idNotificationQueue'> { }