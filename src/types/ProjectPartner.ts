import { Optional } from 'sequelize';


import Project from "./Project";
import User from "./User";

export default interface ProjectPartner {
    idProjectPartners: number;
    idProjects: number;
    idUsers: number;
    createdAt?: Date | null;
    updatedAt?: Date | null;
    Project?: Project;
    User?: User;
}

export interface ProjectPartnerAttributes extends Optional<ProjectPartner, 'idProjectPartners'> { }