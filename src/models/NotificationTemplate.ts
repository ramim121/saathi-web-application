import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/db';
import { NotificationTemplatesAttributes } from '@/types/NotificationTemplate';

interface NotificationTemplateModel extends NotificationTemplatesAttributes, Model { }

const NotificationTemplate = sequelize.define<NotificationTemplateModel>('NotificationTemplate', {
    idNotificationTemplates: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    notificationName: {
        type: DataTypes.STRING,
        allowNull: true
    },
    smsTemplate: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    emailSubject: {
        type: DataTypes.STRING,
        allowNull: true
    },
    emailTemplate: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    pushNotificationTitle: {
        type: DataTypes.STRING,
        allowNull: true
    },
    pushNotificationTemplate: {
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
    }
}, {
    tableName: 'notification_templates',
    underscored: true,
    timestamps: true,
});

export default NotificationTemplate;