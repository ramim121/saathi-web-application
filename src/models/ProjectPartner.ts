import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/db';

import { ProjectPartnerAttributes } from '@/types/ProjectPartner';

interface ProjectPartnerModel extends ProjectPartnerAttributes, Model { }

const ProjectPartner = sequelize.define<ProjectPartnerModel>('ProjectPartner', {
    idProjectPartners: {
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
    tableName: 'project_partners',
    underscored: true,
    timestamps: true,
});

export default ProjectPartner;