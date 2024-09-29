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
    productCategories: {
        type: DataTypes.STRING(512),
        allowNull: true,
        defaultValue: ',',
    },
    idUnit: {
        type: DataTypes.INTEGER,
        allowNull: false,
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