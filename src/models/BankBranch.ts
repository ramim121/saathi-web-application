import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/db';
import { BankBranchAttributes } from '@/types/BankBranch';

interface BankBranchModel extends BankBranchAttributes, Model { };

const BankBranch = sequelize.define<BankBranchModel>('BankBranch', {
    idBankBranches: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    idBanks: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    branchName: {
        type: DataTypes.STRING,
        allowNull: false
    },
    branchCode: {
        type: DataTypes.STRING,
        allowNull: false
    },

    routingNumber: {
        type: DataTypes.STRING,
        allowNull: false
    },
    address: {
        type: DataTypes.STRING(512),
        allowNull: false
    },
    swiftCode: {
        type: DataTypes.STRING,
        allowNull: false
    },
    telephone: {
        type: DataTypes.STRING,
        allowNull: false
    },
    fax: {
        type: DataTypes.STRING,
        allowNull: false
    },
    email: {
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
    tableName: 'bank_branches',
    underscored: true,
    timestamps: true,
});

export default BankBranch;