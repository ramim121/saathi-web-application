import { Optional } from 'sequelize';

export default interface ProjectSpecialBookingReq {
    idProjectSpecialBookingReqs: number;
    idProjectInvestors: number;
    deliveryLocation: string;
    preferredColor: number;
    preferredProductPrice: number;
    additionalRequest: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface ProjectSpecialBookingReqAttributes extends Optional<ProjectSpecialBookingReq, 'idProjectSpecialBookingReqs'> { }