import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/db';

import { ProjectPartnerInvestorAttributes } from '@/types/ProjectPartnerInvestor';

interface ProjectPartnerInvestorModel extends ProjectPartnerInvestorAttributes, Model { }

const ProjectPartnerInvestor = sequelize.define<ProjectPartnerInvestorModel>('ProjectPartnerInvestor', {
    idProjectPartnerInvestors: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    idProjectInvestors: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    idProjectPartners: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    amountInvested: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false
    },
    investedUnit: {
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
    tableName: 'project_partner_investors',
    underscored: true,
    timestamps: true
});

export default ProjectPartnerInvestor;