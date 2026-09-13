import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/db';

import { ProjectPropertyAttributes } from '@/types/ProjectProperty';

interface ProjectPropertyModel extends ProjectPropertyAttributes, Model { }

const ProjectProperty = sequelize.define<ProjectPropertyModel>('ProjectProperty', {
    idProjectProperties: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    idProjects: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    cattleLiveWeightRate: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false
    },
    cattleInitialWeightMin: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false
    },
    cattleInitialWeightMax: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false
    },
    cattleFinalWeightMin: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false
    },
    cattleFinalWeightMax: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false
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
    tableName: 'project_properties',
    underscored: true,
    timestamps: true
});

export default ProjectProperty;