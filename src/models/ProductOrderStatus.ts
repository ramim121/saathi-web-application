import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/db';
import { ProductOrderStatusAttributes } from '@/types/ProductOrderStatus';
import { stat } from 'fs';

interface ProductOrderStatusModel extends ProductOrderStatusAttributes, Model { }

const ProductOrderStatus = sequelize.define<ProductOrderStatusModel>('ProductOrderStatus', {
    idProductOrderStatus: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    idProductOrders: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    idUsers: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    statusName: {
        type: DataTypes.ENUM('placed', 'confirmed', 'shipped', 'delivered', 'cancelled', 'paid', 'returned'),
        allowNull: false,
    },
    statusDescription: {
        type: DataTypes.STRING(255),
        allowNull: true,
    },
    remarks: {
        type: DataTypes.STRING(255),
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
    tableName: 'product_order_status',
    underscored: true,
    timestamps: true,
});

export default ProductOrderStatus;