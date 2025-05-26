import { Optional } from 'sequelize';

export default interface ProductPacking {
    idProductPackings: number;
    packingName: string;
    size: number;
    idProducts: number;
    createdAt: Date;
    updatedAt: Date;
};

export interface ProductPackingAttributes extends Optional<ProductPacking, 'idProductPackings'> { }