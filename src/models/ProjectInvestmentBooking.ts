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
        type: DataTypes.ENUM('beftn', 'rtgs', 'npsb', 'cash', 'cheque'),
        allowNull: true
    },
    collectionRequired: {
        type: DataTypes.ENUM('yes', 'no'),
        defaultValue: 'no',
        allowNull: false
    },
    collectionStatus: {
        type: DataTypes.ENUM('pending', 'collected', 'failed'),
        allowNull: true
    },
    collectionDate: {
        type: DataTypes.DATE,
        allowNull: true
    },
    collectionLocation: {
        type: DataTypes.STRING,
        allowNull: true
    },
    paymentConfirmationStatus: {
        type: DataTypes.ENUM('pending', 'uploaded', 'confirmed', 'denied'),
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
    paymentDate: {
        type: DataTypes.DATE,
        allowNull: true
    },
    transactionId: {
        type: DataTypes.STRING,
        allowNull: true
    },
    createdAt: {
        type: DataTypes.DATE,
        allowNull: false
    },
    updatedAt: {
        type: DataTypes.DATE,
        allowNull: false
    },
    idUserBanks: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    proofOfPayment: {
        type: DataTypes.STRING,
        allowNull: true
    },
    cancelled: {
        type: DataTypes.ENUM('yes', 'no'),
        allowNull: false,
        defaultValue: 'no'
    }
}, {
    tableName: 'project_investment_bookings',
    underscored: true,
    timestamps: true,
});

export default ProjectInvestmentBooking;