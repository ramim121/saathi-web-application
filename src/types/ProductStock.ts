import { Optional } from 'sequelize';

export default interface ProductStock {
    idProductStock: number;
    idProducts: number | null;
    idProductPackings: number;
    stockInCount: number;
    stockOutCount: number;
    idUsers: number;
    rate: number | null;
    method: 'sell' | 'adjustment' | 'stock-in' | null;
    createdAt: Date;
    updatedAt: Date;
}

export interface ProductStockAttributes extends Optional<ProductStock, 'idProductStock'> { }