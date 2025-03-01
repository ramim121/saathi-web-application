import { Optional } from 'sequelize';
import User from "./User";

export default interface ProductPartner {
    idProductPartners: number;
    idUsers: number;
    idProducts: number;
    sellRate: number;
    idProductPackings: number;
    createdAt: Date;
    updatedAt: Date;
    User?: User;
}

export interface ProductPartnerAttributes extends Optional<ProductPartner, 'idProductPartners'> { }