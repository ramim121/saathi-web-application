import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/db';

import { ProjectInvestmentBookingAttributes } from '@/types/ProjectInvestmentBooking';

interface ProjectInvestmentBookingModel extends ProjectInvestmentBookingAttributes, Model { }

const ProjectInvestmentBooking = sequelize.define<ProjectInvestmentBookingModel>('ProjectInvestmentBooking', {
    idProjectInvestmentBookings: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    idUsers: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    paymentMethod: {
        type: DataTypes.ENUM('bank', 'cash', 'card', 'mobile'),
        allowNull: false
    },
    bookingId: {
        type: DataTypes.STRING,
        allowNull: true
    },
    paymentAmount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true
    },
    transactionId: {
        type: DataTypes.STRING,
        allowNull: true
    },
    createDate: {
        type: DataTypes.DATE,
        allowNull: false
    },
    updateDate: {
        type: DataTypes.DATE,
        allowNull: false
    },
    idUserBanks: {
        type: DataTypes.INTEGER,
        allowNull: true
    }
}, {
    tableName: 'project_investment_bookings',
    underscored: true,
    timestamps: true,
});

export default ProjectInvestmentBooking;