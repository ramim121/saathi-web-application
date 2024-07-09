import { Optional } from 'sequelize';

export default interface ProjectPartnerInvestor {
    idProjectPartnerInvestors: number;
    idProjectInvestors: number;
    idProjectPartners: number;
    amountInvested: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface ProjectPartnerInvestorAttributes extends Optional<ProjectPartnerInvestor, 'idProjectPartnerInvestors'> { }