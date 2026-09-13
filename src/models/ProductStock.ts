import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/db';
import { ProductStockAttributes } from '@/types/ProductStock';

interface ProductStockModel extends ProductStockAttributes, Model { }

const ProductStock = sequelize.define<ProductStockModel>('ProductStock', {
    idProductStock: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    idProducts: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    idProductPackings: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    stockInCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
    },
    stockOutCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
    },
    idUsers: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    rate: {
        type: DataTypes.DOUBLE(12, 2),
        allowNull: true,
    },
    method: {
        type: DataTypes.ENUM('sell', 'adjustment', 'stock-in'),
        allowNull: true,
        defaultValue: null,
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
    tableName: 'product_stock',
    underscored: true,
    timestamps: true,
});

export default ProductStock;