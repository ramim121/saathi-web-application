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
        allowNull: false
    },
    projectName: {
        type: DataTypes.STRING,
        allowNull: false
    },
    summary: {
        type: DataTypes.TEXT,
        allowNull: false
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
        type: DataTypes.DECIMAL(12,2),
        allowNull: false
    },
    returnRangeMax: {
        type: DataTypes.DECIMAL(12,2),
        allowNull: false
    },
    returnType: {
        type: DataTypes.ENUM('fixed', 'range'),
        allowNull: false
    },
    duration: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    unitInvestmentValue: {
        type: DataTypes.DECIMAL(12,2),
        allowNull: false
    },
    totalReturnMin: {
        type: DataTypes.DECIMAL(12,2),
        allowNull: false
    },
    totalReturnMax: {
        type: DataTypes.DECIMAL(12,2),
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
        type: DataTypes.DECIMAL(12,2),
        allowNull: false
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
        type: DataTypes.ENUM('created','collection_started','collection_done','project_started','project_finished','fund_disbursed','closed'),
        defaultValue: 'pending',
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
});

export default Project;