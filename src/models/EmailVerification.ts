import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/db';

/**
 * Proof-of-address challenges. Migration 008.
 *
 * `users.email_verified` has always existed and is read all over the codebase,
 * but until now there was no way for anyone to *earn* it: it is set to 'yes' in
 * exactly one place, the Google sign-in handler, because Google asserts the
 * address. Anyone who typed their address into their profile stayed at 'no'
 * forever — which is also what made Google create them a second account, since
 * that lookup only matches verified or linked addresses.
 *
 * TWO CHALLENGES PER ROW
 * A link is better on a desktop; a 6-digit code is the only thing that works
 * when mail and browser are separate apps on a phone. Both are issued together
 * so the person uses whichever is in front of them, and consuming either burns
 * both — `consumedAt` is on the row, not on the individual challenge.
 *
 * DIGESTS ONLY
 * Same rule as `AppOtp`: a database dump must not hand out live credentials.
 * The token and the code exist in clear text once, inside the email.
 *
 * WHY `email` IS ON THIS ROW
 * The address being proved is the one that was requested, not whatever
 * `users.email` says at the moment the link is clicked. Without this, changing
 * the address after requesting a link would let the old link verify the new
 * one — which is a way to get a verified flag on an address you do not own.
 */

export interface EmailVerificationAttributes {
    idEmailVerifications: number;
    idUsers: number;
    /** The address this challenge proves. Compared, never trusted from input. */
    email: string;
    /** SHA-256 of the link token. */
    tokenHash: string;
    /** SHA-256 of the 6-digit code, salted with the address. */
    codeHash: string;
    expiresAt: Date;
    attempts: number;
    consumedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface EmailVerificationModel extends EmailVerificationAttributes, Model { }

const EmailVerification = sequelize.define<EmailVerificationModel>('EmailVerification', {
    idEmailVerifications: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    idUsers: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    email: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    tokenHash: {
        type: DataTypes.STRING(64),
        allowNull: false,
    },
    codeHash: {
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
    tableName: 'email_verifications',
    underscored: true,
    timestamps: true,
});

export default EmailVerification;
