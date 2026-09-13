import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/db';
import { DigigramBankAttributes } from '@/types/DigigramBank';

interface DigigramBankModel extends DigigramBankAttributes, Model { }

const DigigramBank = sequelize.define<DigigramBankModel>('DigigramBank', {
    idDigigramBanks: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    bankName: {
        type: DataTypes.STRING,
        allowNull: false
    },
    branchName: {
        type: DataTypes.STRING,
        allowNull: false
    },
    accountName: {
        type: DataTypes.STRING,
        allowNull: false
    },
    accountNumber: {
        type: DataTypes.STRING,
        allowNull: false
    },
    routingNumber: {
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
    tableName: 'digigram_banks',
    underscored: true,
    timestamps: true,
});

export default DigigramBank;