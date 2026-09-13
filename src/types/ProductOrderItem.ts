import { Optional } from 'sequelize';

export default interface ProductOrderItem {
    idProductOrderItems: number;
    idProductOrders: number;
    idProducts: number;
    idProductPartners: number;
    quantity: number;
    rate: number;
    createdAt: Date;
    updatedAt: Date;
};

export interface ProductOrderItemAttributes extends Optional<ProductOrderItem, 'idProductOrderItems'> { }