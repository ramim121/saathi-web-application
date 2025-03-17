import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/db';
import { UserAddressAttributes } from '@/types/UserAddress';

interface UserAddressModel extends UserAddressAttributes, Model { }

const UserAddress = sequelize.define<UserAddressModel>('UserAddress', {
    idUserAddresses: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    idUsers: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    phone: {
        type: DataTypes.STRING,
        allowNull: false
    },
    idDivisions: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    idDistricts: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    idPoliceStations: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    addressLine1: {
        type: DataTypes.STRING,
        allowNull: false
    },
    addressLine2: {
        type: DataTypes.STRING,
        allowNull: true
    },
    postalCode: {
        type: DataTypes.STRING,
        allowNull: true
    },
    insideDhaka: {
        type: DataTypes.ENUM('yes', 'no'),
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
    tableName: 'user_addresses',
    underscored: true,
    timestamps: true,
});

export default UserAddress;