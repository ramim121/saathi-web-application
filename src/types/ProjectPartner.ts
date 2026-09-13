import { Optional } from 'sequelize';
import Project from "./Project";
import User from "./User";
import ProjectPartnerInvestor from "./ProjectPartnerInvestor";

export default interface ProjectPartner {
    idProjectPartners: number;
    idProjects: number;
    idUsers: number;
    createdAt?: Date | null;
    updatedAt?: Date | null;
    partnerUnitCapacity: number;
    ProjectPartnerInvestors?: ProjectPartnerInvestor[];
    Project?: Project;
    User?: User;
    alreadyInvestedUnits?: number;
}

export interface ProjectPartnerAttributes extends Optional<ProjectPartner, 'idProjectPartners'> { }