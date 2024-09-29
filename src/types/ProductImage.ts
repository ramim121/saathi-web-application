import { Optional } from 'sequelize';

export default interface ProductImage {
    idProductImages: number;
    imageName: string;
    imageNameOriginal: string;
    idProducts: number;
    imageStatus: 'active' | 'deleted' | 'hidden';
    createdAt: Date;
    updatedAt: Date;
};


export interface ProductImageAttributes extends Optional<ProductImage, 'idProductImages'> { }