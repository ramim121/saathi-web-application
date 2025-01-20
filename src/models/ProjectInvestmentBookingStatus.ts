import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/db';
import { ProjectInvestmentBookingStatusAttributes } from '@/types/ProjectInvestmentBookingStatus';

interface ProjectInvestmentBookingStatusModel extends ProjectInvestmentBookingStatusAttributes, Model { }

const ProjectInvestmentBookingStatus = sequelize.define<ProjectInvestmentBookingStatusModel>('ProjectInvestmentBookingStatus', {

    idProjectInvestmentBookingStatus: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    status: {
        type: DataTypes.STRING,
        allowNull: false
    },
    idProjectInvestmentBookings: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    idUsers: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    remarks: {
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
    },
}, {
    tableName: 'project_investment_booking_status',
    underscored: true,
    timestamps: true,
});

export default ProjectInvestmentBookingStatus;