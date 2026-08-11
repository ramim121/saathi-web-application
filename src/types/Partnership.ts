import { Optional } from 'sequelize';

export default interface Partnership {
    idPartnerships: number;
    image: string;
    name: string;
    // Bangla counterpart (migration 002); null falls back to English.
    nameBn?: string | null;
    priority: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface PartnershipAttributes extends Optional<Partnership, 'idPartnerships'> { }