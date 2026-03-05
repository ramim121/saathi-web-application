import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/db';
import { PartnerAdditionalInfoAttributes } from '@/types/PartnerAdditionalInfo';

interface PartnerAdditionalInfoModel extends PartnerAdditionalInfoAttributes, Model { }

const PartnerAdditionalInfo = sequelize.define<PartnerAdditionalInfoModel>('PartnerAdditionalInfo', {
    idPartnerAdditionalInfo: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    idUsers: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    gender: {
        type: DataTypes.ENUM('Male', 'Female', 'Other'),
        allowNull: false
    },
    household_size: {
        type: DataTypes.STRING,
        allowNull: false
    },
    dependents_size: {
        type: DataTypes.STRING,
        allowNull: false
    },
    livelihood_activity: {
        type: DataTypes.STRING,
        allowNull: false
    },
    primary_goal: {
        type: DataTypes.STRING,
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
    tableName: 'partner_additional_info',
    underscored: true,
    timestamps: true,
});

export default PartnerAdditionalInfo;