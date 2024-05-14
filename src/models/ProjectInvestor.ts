import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/db';

import { ProjectInvestorAttributes } from '@/types/ProjectInvestor';

interface ProjectInvestorModel extends ProjectInvestorAttributes, Model { }

const ProjectInvestor = sequelize.define<ProjectInvestorModel>('ProjectInvestor', {
    idProjectInvestors: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    idProjects: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    idUsers: {
        type: DataTypes.INTEGER,
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
    tableName: 'project_investors',
    underscored: true,
    timestamps: true,
});

export default ProjectInvestor;