import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/db';
import { UserBankAttributes } from '@/types/UserBank';

interface UserBankModel extends UserBankAttributes, Model { }

const UserBank = sequelize.define<UserBankModel>('UserBank', {
    idUserBanks: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    idUsers: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    idBanks: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    idBankBranches: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    default: {
        type: DataTypes.ENUM('yes', 'no'),
        allowNull: false,
        defaultValue: 'no'
    },
    accountHolderName: {
        type: DataTypes.STRING,
        allowNull: false
    },
    accountNumber: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
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
    tableName: 'user_banks',
    underscored: true,
    timestamps: true,
});

export default UserBank;