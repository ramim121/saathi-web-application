import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/db';

import { DivisionAttributes } from '@/types/Division';

interface DivisionModel extends DivisionAttributes, Model { }

const Division = sequelize.define<DivisionModel>('Division', {
    idDivisions: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
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
    tableName: 'divisions',
    underscored: true,
    timestamps: false,
});

export default Division;