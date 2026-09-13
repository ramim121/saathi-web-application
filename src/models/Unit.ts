import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/db';
import { UnitAttributes } from '@/types/Unit';

interface UnitModel extends UnitAttributes, Model { }

const Unit = sequelize.define<UnitModel>('Unit', {
    idUnit: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    unitName: {
        type: DataTypes.STRING,
        allowNull: false
    },
    unitCode: {
        type: DataTypes.STRING,
        allowNull: false
    },
    createdAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    updatedAt: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: 'unit',
    underscored: true,
    timestamps: true,
});

export default Unit;