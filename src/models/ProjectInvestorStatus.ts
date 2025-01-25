import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/db';
import { ProjectInvestorStatusAttributes } from '@/types/ProjectInvestorStatus';

interface ProjectInvestorStatusModel extends ProjectInvestorStatusAttributes, Model { }

const ProjectInvestorStatus = sequelize.define<ProjectInvestorStatusModel>('ProjectInvestmentBookingStatus', {

    idProjectInvestorStatus: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    status: {
        type: DataTypes.STRING,
        allowNull: false
    },
    idProjectInvestors: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    idUsers: {
        type: DataTypes.INTEGER,
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
    },
}, {
    tableName: 'project_investor_status',
    underscored: true,
    timestamps: true,
});

export default ProjectInvestorStatus;