import { Optional } from 'sequelize';

export default interface ProjectPartnerInvestor {
    idProjectPartnerInvestors: number;
    idProjectInvestors: number;
    idProjectPartners: number;
    amountInvested: number;
}

export interface ProjectPartnerInvestorAttributes extends Optional<ProjectPartnerInvestor, 'idProjectPartnerInvestors'> { }