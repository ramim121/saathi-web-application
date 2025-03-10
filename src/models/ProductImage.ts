import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/db';
import { ProductImageAttributes } from '@/types/ProductImage';

interface ProductImageModel extends ProductImageAttributes, Model { }

const ProductImage = sequelize.define<ProductImageModel>('ProductImage', {
    idProductImages: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
    },
    imageName: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    imageNameOriginal: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    thumbnail: {
        type: DataTypes.STRING(255),
        allowNull: false,
    },
    idProducts: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    imageStatus: {
        type: DataTypes.ENUM('active', 'deleted', 'hidden'),
        defaultValue: 'active',
        allowNull: false,
    },
    default:{
        type: DataTypes.ENUM('yes', 'no'),
        defaultValue: 'no',
        allowNull:false
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
    tableName: 'product_images',
    underscored: true,
    timestamps: true,
});

export default ProductImage;