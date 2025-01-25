import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/db';
import { AppVersionAttributes } from '@/types/AppVersion';

interface AppVersionModel extends AppVersionAttributes, Model { }

const AppVersion = sequelize.define<AppVersionModel>('AppVersion', {
    idAppVersions: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    versionName: {
        type: DataTypes.STRING,
        allowNull: false
    },
    platform: {
        type: DataTypes.ENUM('android', 'ios'),
        allowNull: false
    },
    appUrl: {
        type: DataTypes.STRING,
        allowNull: false
    },
    remarks: {
        type: DataTypes.STRING(512),
        allowNull: false
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
    tableName: 'app_versions',
    underscored: true,
    timestamps: true,
});

export default AppVersion;