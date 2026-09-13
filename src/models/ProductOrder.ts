import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/db';
import { ProductOrderAttributes } from '@/types/ProductOrder';

interface ProductOrderModel extends ProductOrderAttributes, Model { }

const ProductOrder = sequelize.define<ProductOrderModel>('ProductOrder', {
    idProductOrders: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    orderedBy: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    orderId: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    orderAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
    },
    orderStatus: {
        type: DataTypes.ENUM('placed', 'confirmed', 'shipped', 'delivered', 'cancelled', 'paid', 'returned'),
        allowNull: false,
    },
    specialInstructions: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    idUserAddresses: {
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
    tableName: 'product_orders',
    underscored: true,
    timestamps: true,
});

export default ProductOrder;
