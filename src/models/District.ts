import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/db';

import { DistrictAttributes } from '@/types/District';

interface DistrictModel extends DistrictAttributes, Model { }

const District = sequelize.define<DistrictModel>('District', {
    idDistricts: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    idDivisions: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    name: {
        type: DataTypes.STRING(45),
        allowNull: false
    },
    bnName: {
        type: DataTypes.STRING(45),
        allowNull: false
    },
    lat: {
        type: DataTypes.DOUBLE,
        allowNull: true
    },
    lon: {
        type: DataTypes.DOUBLE,
        allowNull: true
    },
    url: {
        type: DataTypes.STRING(45),
        allowNull: false
    },
}, {
    tableName: 'districts',
    underscored: true,
    timestamps: false,
});

export default District;