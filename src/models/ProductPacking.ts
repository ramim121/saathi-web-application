import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/db';
import { ProductPackingAttributes } from '@/types/ProductPacking';

interface ProductPackingModel extends ProductPackingAttributes, Model { }

const ProductPacking = sequelize.define<ProductPackingModel>('ProductPacking', {
    idProductPackings: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    packingName: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    size: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    idProducts: {
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
    tableName: 'product_packings',
    underscored: true,
    timestamps: true,
});

export default ProductPacking;