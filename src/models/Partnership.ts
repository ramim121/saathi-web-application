import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/db';
import { PartnershipAttributes } from '@/types/Partnership';

interface PartnershipModel extends PartnershipAttributes, Model { }

const Partnership = sequelize.define<PartnershipModel>('Partnership', {
    idPartnerships: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    image: {
        type: DataTypes.STRING,
        allowNull: false
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    // Bangla counterpart — migration 002_bangla_columns.sql.
    nameBn: {
        type: DataTypes.STRING,
        allowNull: true
    },
    priority: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    createdAt: {
        type: DataTypes.DATE,
        allowNull: false
    },
    updatedAt: {
        type: DataTypes.DATE,
        allowNull: false
    }
}, {
    tableName: 'partnerships',
    underscored: true,
    timestamps: true,
});

export default Partnership;