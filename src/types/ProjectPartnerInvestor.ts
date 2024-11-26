import { Optional } from 'sequelize';
import ProjectPartner from './ProjectPartner';
import ProjectInvestor from './ProjectInvestor';

export default interface ProjectPartnerInvestor {
    idProjectPartnerInvestors: number;
    idProjectInvestors: number;
    idProjectPartners: number;
    amountInvested: number;
    createdAt: Date;
    updatedAt: Date;
    ProjectPartner: ProjectPartner;
    ProjectInvestor: ProjectInvestor;
}

export interface ProjectPartnerInvestorAttributes extends Optional<ProjectPartnerInvestor, 'idProjectPartnerInvestors'> { }