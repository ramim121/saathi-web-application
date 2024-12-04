import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/db';
import { AppFcmTokenAttributes } from '@/types/AppFcmToken';

interface AppFcmTokenModel extends AppFcmTokenAttributes, Model { }

const AppFcmToken = sequelize.define<AppFcmTokenModel>('AppFcmToken', {
    idAppFcmTokens: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    idUsers: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    fcmToken: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    publicationStatus: {
        type: DataTypes.ENUM('activated', 'deactivated'),
        allowNull: false,
        defaultValue: 'activated'
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
    tableName: 'app_fcm_tokens',
    underscored: true,
    timestamps: true,
});

export default AppFcmToken;
