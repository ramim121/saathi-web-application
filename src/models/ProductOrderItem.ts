import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/db';
import { ProductOrderItemAttributes } from '@/types/ProductOrderItem';

interface ProductOrderItemModel extends ProductOrderItemAttributes, Model { }

const ProductOrderItem = sequelize.define<ProductOrderItemModel>('ProductOrderItem', {
    idProductOrderItems: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    idProductOrders: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    idProducts: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    idProductPartners: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    rate: {
        type: DataTypes.DECIMAL(10, 2),
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
    tableName: 'product_order_items',
    underscored: true,
    timestamps: true,
});

export default ProductOrderItem;