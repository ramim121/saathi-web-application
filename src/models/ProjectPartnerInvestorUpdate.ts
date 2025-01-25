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
    idProjectPartners: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    updateDate: {
        type: DataTypes.DATE,
        allowNull: false
    },
    updateBody: {
        type: DataTypes.STRING(512),
        allowNull: false
    },
    updateTitle: {
        type: DataTypes.STRING,
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
    tableName: 'project_partner_investor_updates',
    underscored: true,
    timestamps: true
});

export default ProjectPartnerInvestorUpdate;