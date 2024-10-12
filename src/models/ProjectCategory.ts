import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/db';
import { ProjectCategoryAttributes } from '@/types/ProjectCategory';

interface ProjectCategoryModel extends ProjectCategoryAttributes, Model { }

const ProjectCategory = sequelize.define<ProjectCategoryModel>('ProjectCategory', {
    idProjectCategories: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    categoryName: {
        type: DataTypes.STRING,
        allowNull: false
    },
    categoryImage: {
        type: DataTypes.STRING,
        allowNull: true
    },
    createdAt: {
        type: DataTypes.DATE,
        allowNull: false
    },
    updatedAt: {
        type: DataTypes.DATE,
        allowNull: false
    },
}, {
    tableName: 'project_categories',
    underscored: true,
    timestamps: true,
});

export default ProjectCategory;