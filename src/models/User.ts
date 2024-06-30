import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/db';
import { UserAttributes } from '@/types/User';

interface UserModel extends UserAttributes, Model { }

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
        allowNull: false
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
    profileImage: {
        type: DataTypes.STRING,
        allowNull: true
    },
    status: {
        type: DataTypes.ENUM('active', 'inactive'),
        defaultValue: 'active',
        allowNull: false
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
