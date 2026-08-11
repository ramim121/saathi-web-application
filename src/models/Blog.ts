import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/db';
import { BlogAttributes } from '@/types/Blog';

interface BlogModel extends BlogAttributes, Model { }

const Blog = sequelize.define<BlogModel>('Blog', {
    idBlogs: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    heading: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    // Bangla counterparts — migration 002_bangla_columns.sql. Nullable; null
    // falls back to the English column.
    headingBn: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    descriptionBn: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    featuredImage: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    featuredImageThumb: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    writtenBy: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    writtenDate: {
        type: DataTypes.DATE,
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
    tableName: 'blogs',
    underscored: true,
    timestamps: true,
});

export default Blog;