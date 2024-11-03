import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/db';
import { ProjectAttributes } from '@/types/Project';

interface ProjectModel extends ProjectAttributes, Model { }

const Project = sequelize.define<ProjectModel>('Project', {
    idProjects: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    idProjectCategories: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    projectName: {
        type: DataTypes.STRING,
        allowNull: false
    },
    summary: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    projectBanner: {
        type: DataTypes.STRING,
        allowNull: true
    },
    location: {
        type: DataTypes.STRING,
        allowNull: false
    },
    returnRangeMin: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false
    },
    returnRangeMax: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false
    },
    investmentType: {
        type: DataTypes.ENUM('sustainable_return', 'fast_return'),
        allowNull: false,
        defaultValue: 'sustainable_return'
    },
    returnType: {
        type: DataTypes.ENUM('variable', 'fixed'),
        allowNull: false
    },
    duration: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    tenure: {
        type: DataTypes.ENUM('months', 'years'),
        allowNull: false,
        defaultValue: 'months'
    },
    unitInvestmentValue: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false
    },
    totalReturnMin: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false
    },
    totalReturnMax: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: false
    },
    collectionStarts: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    collectionEnds: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    insurance: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true
    },
    otherLocations: {
        type: DataTypes.STRING,
        allowNull: true
    },
    createdBy: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    projectStatus: {
        type: DataTypes.ENUM('created', 'collection_started', 'collection_done', 'project_started', 'project_finished', 'fund_disbursed', 'closed', 'completed'),
        defaultValue: 'pending',
        allowNull: false
    },
    showInUpcoming: {
        type: DataTypes.ENUM('yes', 'no'),
        defaultValue: 'no',
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
    tableName: 'projects',
    underscored: true,
    timestamps: true,
});

export default Project;