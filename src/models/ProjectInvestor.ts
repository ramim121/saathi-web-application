import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/db';

import { ProjectInvestorAttributes } from '@/types/ProjectInvestor';

interface ProjectInvestorModel extends ProjectInvestorAttributes, Model { }

const ProjectInvestor = sequelize.define<ProjectInvestorModel>('ProjectInvestor', {
    idProjectInvestors: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    idProjects: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    idUsers: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    unitPurchased: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    investmentStatus: {
        type: DataTypes.ENUM('booked', 'confirmed', 'request_withdrawal', 'ready_for_withdrawal', 'withdrawn', 'reinvested_full', 'reinvested_capital', 'reinvested_profit', 'cancelled'),
        allowNull: false,
        defaultValue: 'booked'
    },
    investmentDate: {
        type: DataTypes.DATEONLY,
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
    actualProfitPercentage: {
        type: DataTypes.FLOAT,
        allowNull: true,
    },
    actualProfitAmount: {
        type: DataTypes.FLOAT,
        allowNull: true,
    }
}, {
    tableName: 'project_investors',
    underscored: true,
    timestamps: true,
});

export default ProjectInvestor;