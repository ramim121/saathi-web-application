import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/db';
import { ProductPartnerAttributes } from '@/types/ProductPartner';

interface ProductPartnerModel extends ProductPartnerAttributes, Model { }

const ProductPartner = sequelize.define<ProductPartnerModel>('ProductPartner', {
    idProductPartners: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    idUsers: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    idProducts: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    sellRate: {
        type: DataTypes.DOUBLE(12, 2),
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
    tableName: 'product_partners',
    underscored: true,
    timestamps: true,
});

export default ProductPartner;