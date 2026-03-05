import { Optional } from 'sequelize';

export default interface Partnership {
    idPartnerships: number;
    image: string;
    name: string;
    priority: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface PartnershipAttributes extends Optional<Partnership, 'idPartnerships'> { }