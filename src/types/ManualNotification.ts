import { Optional } from 'sequelize';
import User from './User';

export default interface ManualNotification {
    idManualNotifications: number;
    sendViaSms: 'yes' | 'no';
    sendViaEmail: 'yes' | 'no';
    sendViaPush: 'yes' | 'no';
    smsBody: string;
    pushNotificationTitle: string;
    pushNotificationBody: string;
    pushNotificationImage: string;
    emailSubject: string;
    emailBody: string;
    sendOn: Date;
    createdAt: Date;
    updatedAt: Date;
    createdBy: number;
    User?: User;
}

export interface ManualNotificationAttributes extends Optional<ManualNotification, 'idManualNotifications'> { }