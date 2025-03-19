import { Optional } from 'sequelize';

export default interface ProductOrder {
    idProductOrders: number;
    orderedBy: number;
    orderAmount: number;
    orderId: string;
    orderStatus: 'placed' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled' | 'paid' | 'returned';
    specialInstructions: string;
    idUserAddresses: number;
    createdAt: Date;
    updatedAt: Date;
};

export interface ProductOrderAttributes extends Optional<ProductOrder, 'idProductOrders'> { }