import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/db';
import { ProductCategoryAttributes } from '@/types/ProductCategory';

interface ProductCategoryModel extends ProductCategoryAttributes, Model { }

const ProductCategory = sequelize.define<ProductCategoryModel>('ProductCategory', {
    idProductCategories: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    productCategoryName: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    productCategoryId: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    parentProductCategory: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    categoryImage: {
        type: DataTypes.STRING(255),
        allowNull: true,
    },
    status: {
        type: DataTypes.ENUM('active', 'inactive'),
        allowNull: false,
        defaultValue: 'active'
    },
    createdAt: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: DataTypes.NOW,
    },
    updatedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: DataTypes.NOW,
    }
}, {
    tableName: 'product_categories',
    underscored: true,
    timestamps: true,
});

export default ProductCategory;