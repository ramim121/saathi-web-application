import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/db';

/**
 * One-time passcodes, persisted.
 *
 * OTPs used to live in a module-level object in the API process. That meant:
 *   - every deploy dropped all codes in flight (the workflow does
 *     `pm2 delete` then `pm2 start`, so this happened on every release);
 *   - under PM2 cluster mode or more than one instance, the worker that issued
 *     the code was often not the worker that verified it, so verification
 *     failed at random;
 *   - the map only shrank on a successful verify, so it grew forever.
 *
 * Storing them makes verification correct across instances and restarts, and
 * gives us an attempt counter and an audit trail.
 */

export interface AppOtpAttributes {
    idAppOtps: number;
    phoneNumber: string;
    /** Stored as a SHA-256 hex digest, never in clear text. */
    otpHash: string;
    expiresAt: Date;
    attempts: number;
    consumedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

interface AppOtpModel extends AppOtpAttributes, Model { }

const AppOtp = sequelize.define<AppOtpModel>('AppOtp', {
    idAppOtps: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    phoneNumber: {
        type: DataTypes.STRING(20),
        allowNull: false,
    },
    otpHash: {
        type: DataTypes.STRING(64),
        allowNull: false,
    },
    expiresAt: {
        type: DataTypes.DATE,
        allowNull: false,
    },
    attempts: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
    },
    consumedAt: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
    },
    updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
    },
}, {
    tableName: 'app_otps',
    underscored: true,
    timestamps: true,
    indexes: [
        { fields: ['phone_number'] },
        { fields: ['expires_at'] },
    ],
});

export default AppOtp;
