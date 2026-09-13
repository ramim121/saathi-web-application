import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/db';
import { ManualNotificationAttributes } from '@/types/ManualNotification';

interface ManualNotificationModel extends ManualNotificationAttributes, Model { }

const ManualNotification = sequelize.define<ManualNotificationModel>('ManualNotification', {
	idManualNotifications: {
		type: DataTypes.INTEGER,
		primaryKey: true,
		autoIncrement: true,
		allowNull: false,
	},
	sendViaSms: {
		type: DataTypes.ENUM('yes', 'no'),
		allowNull: false,
		defaultValue: 'no',
	},
	sendViaEmail: {
		type: DataTypes.ENUM('yes', 'no'),
		allowNull: false,
		defaultValue: 'no',
	},
	sendViaPush: {
		type: DataTypes.ENUM('yes', 'no'),
		allowNull: false,
		defaultValue: 'no',
	},
	smsBody: {
		type: DataTypes.STRING(255),
		allowNull: true,
	},
	pushNotificationTitle: {
		type: DataTypes.STRING(255),
		allowNull: true,
	},
	pushNotificationBody: {
		type: DataTypes.STRING(512),
		allowNull: true,
	},
	pushNotificationImage: {
		type: DataTypes.STRING(255),
		allowNull: true,
	},
	emailSubject: {
		type: DataTypes.STRING(255),
		allowNull: true,
	},
	emailBody: {
		type: DataTypes.STRING(255),
		allowNull: true,
	},
	sendOn: {
		type: DataTypes.DATE,
		allowNull: false,
		defaultValue: DataTypes.NOW,
	},
	createdAt: {
		type: DataTypes.DATE,
		allowNull: false,
		defaultValue: DataTypes.NOW,
	},
	updatedAt: {
		type: DataTypes.DATE,
		allowNull: false,
		defaultValue: DataTypes.NOW,
	},
	createdBy: {
		type: DataTypes.INTEGER,
		allowNull: true,
	},
}, {
	tableName: 'manual_notifications',
	underscored: true,
	timestamps: true,
});

export default ManualNotification;

function moment(arg0: any) {
	throw new Error('Function not implemented.');
}
