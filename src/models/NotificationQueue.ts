import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/db';
import { NotificationQueueAttributes } from '@/types/NotificationQueue';

export interface NotificationQueueModel extends NotificationQueueAttributes, Model { }

const NotificationQueue = sequelize.define<NotificationQueueModel>('NotificationQueue', {
    idNotificationQueue: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    notificationType: {
        type: DataTypes.ENUM('sms', 'push', 'email'),
        allowNull: false
    },
    receiver: {
        type: DataTypes.STRING,
        allowNull: true
    },
    response: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    createdAt: {
        type: DataTypes.DATE,
        allowNull: false
    },
    updatedAt: {
        type: DataTypes.DATE,
        allowNull: false
    },
    sendOn: {
        type: DataTypes.DATE,
        allowNull: true
    },
    attempt: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    status: {
        type: DataTypes.ENUM('pending', 'started', 'failed', 'completed'),
        allowNull: false,
        defaultValue: 'pending'
    },
    notificationBody: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'notification_queue',
    underscored: true,
    timestamps: true,
});

export default NotificationQueue;