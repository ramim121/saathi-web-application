import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/db';
import { ProductAttributes } from '@/types/Product';

interface ProductModel extends ProductAttributes, Model { }

const Product = sequelize.define<ProductModel>('Product', {
    idProducts: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    productName: {
        type: DataTypes.STRING(255),
        allowNull: true,
    },
    idProductCategories: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    idUnit: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    productDescription: {
        type: DataTypes.TEXT,
        allowNull: true,
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
    tableName: 'products',
    underscored: true,
    timestamps: true,
});

export default Product;