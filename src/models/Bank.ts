import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/db';
import { BankAttributes } from '@/types/Bank';

interface BankModel extends BankAttributes, Model { }

const Bank = sequelize.define<BankModel>('Bank', {
    idBanks: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    bankNameShort: {
        type: DataTypes.STRING,
        allowNull: false
    },
    bankNameFull: {
        type: DataTypes.STRING,
        allowNull: false
    },
    bankCode: {
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
    tableName: 'banks',
    underscored: true,
    timestamps: true,
});

export default Bank;