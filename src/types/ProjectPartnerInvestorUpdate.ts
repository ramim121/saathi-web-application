import { Optional } from 'sequelize';

export default interface ProjectPartnerInvestorUpdate {
    idProjectPartnerInvestorUpdates?: number;
    idProjectPartners: number;
    updateDate: Date;
    updateBody: string;
    updateTitle: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface ProjectPartnerInvestorUpdateAttributes extends Optional<ProjectPartnerInvestorUpdate, 'idProjectPartnerInvestorUpdates'> { }