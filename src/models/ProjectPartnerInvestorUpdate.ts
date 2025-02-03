import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/db';

import { ProjectPartnerInvestorUpdateAttributes } from '@/types/ProjectPartnerInvestorUpdate';

interface ProjectPartnerInvestorUpdateModel extends ProjectPartnerInvestorUpdateAttributes, Model { }


const ProjectPartnerInvestorUpdate = sequelize.define<ProjectPartnerInvestorUpdateModel>('ProjectPartnerInvestorUpdate', {
    idProjectPartnerInvestorUpdates: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    idProjectPartnerInvestors: {
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
    },
    liveWeight: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    updateDate: {
        type: DataTypes.DATE,
        allowNull: false
    },
    updateBody: {
        type: DataTypes.STRING(512),
        allowNull: true
    },
    updateTitle: {
        type: DataTypes.STRING,
        allowNull: true
    },
    videoUrl: {
        type: DataTypes.STRING,
        allowNull: true
    },
    updateImage: {
        type: DataTypes.STRING,
        allowNull: true
    },
    imageThumbnail: {
        type: DataTypes.STRING,
        allowNull: true
    }
}, {
    tableName: 'project_partner_investor_updates',
    underscored: true,
    timestamps: true
});

export default ProjectPartnerInvestorUpdate;