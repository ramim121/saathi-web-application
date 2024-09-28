import { Optional } from 'sequelize';

export default interface ProductCategory {
    idProductCategories: number;
    productCategoryName: string;
    productCategoryId: string;
    parentProductCategory: number | null;
    categoryImage: string;
    status: 'active' | 'inactive';
    createdAt: Date;
    updatedAt: Date;
};


export interface ProductCategoryAttributes extends Optional<ProductCategory, 'idProductCategories'> { }