import { Optional } from 'sequelize';

export default interface Product {
    idProducts: number;
    productName: string | null;
    idProductCategories: number;
    idUnit: number;
    productDescription: string | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface ProductAttributes extends Optional<Product, 'idProducts'> { }