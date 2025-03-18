import { Optional } from 'sequelize';

export default interface UserAddress {
    idUserAddresses: number;
    idUsers: number;
    phone: string | null;
    receiverName: string;
    addressType: 'home' | 'office' | 'other';
    defaultAddress: 'yes' | 'no';
    idDivisions?: number | null;
    idDistricts?: number | null;
    idPoliceStations?: number | null;
    addressLine1: string;
    addressLine2?: string | null;
    postalCode?: string;
    insideDhaka: 'yes' | 'no';
    createdAt: Date;
    updatedAt: Date;
}

export interface UserAddressAttributes extends Optional<UserAddress, 'idUserAddresses'> { }