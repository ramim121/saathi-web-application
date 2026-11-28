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
        // 'uploaded' is the legacy name for 'proof_submitted'; both are accepted
        // while the app release that understands the new one rolls out.
        // See src/utils/bookingStatus.ts.
        type: DataTypes.ENUM('pending', 'uploaded', 'proof_submitted', 'confirmed', 'denied'),
        allowNull: false
    },
    // Migration 017. UTC; the end of the payment window (see utils/bookingHolds.ts).
    paymentDueAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    paymentRemindersSent: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 0
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
    },
    // Migration 017. NULL on bookings cancelled before it.
    cancelReason: {
        type: DataTypes.ENUM('investor', 'admin', 'expired', 'reinvestment_undone'),
        allowNull: true
    },
    cancelledAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    cancelledBy: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    bookingType: {
        type: DataTypes.ENUM('fresh', 'reinvestment'),
        allowNull: false,
        defaultValue: 'fresh'
    },
    reinvestedAmount: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0
    },
    idSourceProjectInvestors: {
        type: DataTypes.INTEGER,
        allowNull: true
    }
}, {
    tableName: 'project_investment_bookings',
    underscored: true,
    timestamps: true,
});

export default ProjectInvestmentBooking;