import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/db';
import { InvestmentSetupAttributes } from '@/types/InvestmentSetup';

interface InvestmentSetupModel extends InvestmentSetupAttributes, Model { }

const InvestmentSetup = sequelize.define<InvestmentSetupModel>('InvestmentSetup', {
    idInvestmentSetup: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    planName: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    investmentType: {
        type: DataTypes.ENUM('sustainable_return', 'fast_return'),
        allowNull: false,
        defaultValue: 'sustainable_return'
    },
    returnType: {
        type: DataTypes.ENUM('variable', 'fixed'),
        allowNull: false,
        defaultValue: 'variable'
    },
    minimumReturn: {
        type: DataTypes.DECIMAL(7, 2),
        allowNull: false
    },
    maximumReturn: {
        type: DataTypes.DECIMAL(7, 2),
        allowNull: true,
        defaultValue: null
    },
    duration: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    tenure: {
        type: DataTypes.ENUM('months', 'years'),
        allowNull: false
    },
    createdAt: {
        type: DataTypes.DATE,
        allowNull: false
    },
    updatedAt: {
        type: DataTypes.DATE,
        allowNull: false
    },
}, {
    tableName: 'investment_setup',
    underscored: true,
    timestamps: true,
});

export default InvestmentSetup;