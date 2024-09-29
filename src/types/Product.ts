import { Optional } from 'sequelize';

export default interface Product {
    idProducts: number;
    productName: string | null;
    productCategories: string;
    idUnit: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface ProductAttributes extends Optional<Product, 'idProducts'> { }