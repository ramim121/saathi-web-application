import { Optional } from 'sequelize';

export default interface Unit {
    idUnit: number;
    unitName: string;
    unitCode: string;
    createdAt: Date;
    updatedAt: Date;
};

export interface UnitAttributes extends Optional<Unit, 'idUnit'> { }