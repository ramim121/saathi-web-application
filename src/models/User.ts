import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/db';
import { UserAttributes } from '@/types/User';

export interface UserModel extends UserAttributes, Model { }

const User = sequelize.define<UserModel>('User', {
    idUsers: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    fullName: {
        type: DataTypes.STRING,
        allowNull: true
    },
    email: {
        type: DataTypes.STRING,
        allowNull: true
    },
    phoneNumber: {
        type: DataTypes.STRING,
        allowNull: true
    },
    password: {
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
    userType: {
        type: DataTypes.ENUM('admin', 'investor', 'partner'),
        defaultValue: 'investor',
        allowNull: false
    },
    emailVerified: {
        type: DataTypes.ENUM('yes', 'no'),
        defaultValue: 'no',
        allowNull: false
    },
    phoneVerified: {
        type: DataTypes.ENUM('yes', 'no'),
        defaultValue: 'no',
        allowNull: false
    },
    nidNumber: {
        type: DataTypes.STRING,
        allowNull: true
    },
    nidImageFront: {
        type: DataTypes.STRING,
        allowNull: true
    },
    nidImageBack: {
        type: DataTypes.STRING,
        allowNull: true
    },
    nidVerified: {
        type: DataTypes.ENUM('yes', 'no'),
        defaultValue: 'no',
        allowNull: false
    },
    nidVerificationStatus: {
        type: DataTypes.ENUM('none', 'pending', 'approved', 'rejected'),
        defaultValue: 'none',
        allowNull: false
    },
    profileImage: {
        type: DataTypes.STRING,
        allowNull: true
    },
    status: {
        // 'merged' (migration 009) means this account was joined into another
        // one and `mergedInto` names the survivor. It is NOT 'deleted' — the
        // row is kept so the audit trail stays readable and the merge stays
        // reversible. Queries that mean "a real, usable account" must say
        // ['active', 'inactive'] rather than "not deleted".
        type: DataTypes.ENUM('active', 'inactive', 'deleted', 'merged'),
        defaultValue: 'active',
        allowNull: false
    },
    // Asked once, immediately after signup, alongside the name. Nullable
    // because 425 accounts predate the column — NULL means "never asked",
    // which is different from the answer 'prefer_not_to_say'.
    gender: {
        type: DataTypes.ENUM('male', 'female', 'other', 'prefer_not_to_say'),
        allowNull: true
    },
    // Set together by a merge, never independently.
    // NULL means never asked; the renderer treats that as English, which is
    // what every existing account has always received.
    preferredLanguage: {
        type: DataTypes.ENUM('en', 'bn'),
        allowNull: true
    },
    mergedInto: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    mergedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    googleId: {
        type: DataTypes.STRING,
        allowNull: true
    },
    appleId: {
        type: DataTypes.STRING,
        allowNull: true
    },
    googleLogin: {
        type: DataTypes.ENUM('yes', 'no'),
        defaultValue: 'no',
        allowNull: false
    },
    appleLogin: {
        type: DataTypes.ENUM('yes', 'no'),
        defaultValue: 'no',
        allowNull: false
    },
    dateOfBirth: {
        type: DataTypes.DATE,
        allowNull: true
    },
    age: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    location: {
        type: DataTypes.STRING,
        allowNull: true
    },
    role: {
        type: DataTypes.STRING,
        allowNull: true
    },
    bio: {
        type: DataTypes.STRING,
        allowNull: true
    },
    interestedIn: {
        type: DataTypes.STRING,
        allowNull: true
    },
    skills: {
        type: DataTypes.STRING,
        allowNull: true
    },
    joiningDate: {
        type: DataTypes.DATE,
        allowNull: true
    },
    education: {
        type: DataTypes.STRING,
        allowNull: true
    },
    disability: {
        type: DataTypes.ENUM('yes', 'no'),
        defaultValue: 'no',
        allowNull: false
    },
    // Bangla counterparts — migration 002_bangla_columns.sql. These are the
    // partner-profile fields that render on the public site, so a Bangla visitor
    // needs them in Bangla, including the name in Bangla script.
    // Contact / identity / verification columns are deliberately not translated:
    // they are data, not copy.
    fullNameBn: {
        type: DataTypes.STRING,
        allowNull: true
    },
    roleBn: {
        type: DataTypes.STRING,
        allowNull: true
    },
    bioBn: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    skillsBn: {
        type: DataTypes.STRING,
        allowNull: true
    },
    locationBn: {
        type: DataTypes.STRING,
        allowNull: true
    },
    interestedInBn: {
        type: DataTypes.STRING,
        allowNull: true
    },
    educationBn: {
        type: DataTypes.STRING,
        allowNull: true
    },
    partnerType: {
        type: DataTypes.ENUM('none', 'project', 'product', 'both'),
        defaultValue: 'none',
        allowNull: false
    }
}, {
    tableName: 'users',
    underscored: true,
    timestamps: true,
    defaultScope: {
        attributes: { exclude: ['password'] },
    },
    scopes: {
        withPassword: {
        }
    }
});

export default User;
