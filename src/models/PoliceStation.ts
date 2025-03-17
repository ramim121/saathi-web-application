import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/db';

import { PoliceStationAttributes } from '@/types/PoliceStation';

interface PoliceStationModel extends PoliceStationAttributes, Model { }

const PoliceStation = sequelize.define<PoliceStationModel>('PoliceStation', {
    idPoliceStations: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    idDistricts: {
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
    url: {
        type: DataTypes.STRING(45),
        allowNull: false
    },
}, {
    tableName: 'police_stations',
    underscored: true,
    timestamps: false,
});

export default PoliceStation;