import { Optional } from 'sequelize';
export default interface ProjectInvestorStatus {
    idProjectInvestorStatus: number;
    status: string;
    idProjectInvestors: number;
    idUsers: number;
    remarks: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface ProjectInvestorStatusAttributes extends Optional<ProjectInvestorStatus, 'idProjectInvestorStatus'> { }