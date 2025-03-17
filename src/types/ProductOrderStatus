import { Optional } from 'sequelize';

export interface ProductOrderStatus {
    idProductOrderStatus: number;
    idProductOrders: number;
    idUsers: number;
    statusName: 'placed' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled' | 'paid' | 'returned';
    statusDescription: string;
    remarks: string;
    createdAt: Date;
    updatedAt: Date;
}

export type ProductOrderStatusAttributes = Optional<ProductOrderStatus, 'idProductOrderStatus'>;