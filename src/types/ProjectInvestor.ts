import { Optional } from 'sequelize';
import Project from './Project';
import User from './User';
import ProjectPartnerInvestor from './ProjectPartnerInvestor';

export default interface ProjectInvestor {
    idProjectInvestors: number;
    idProjects: number;
    idUsers: number;
    unitPurchased: number;
    investmentStatus: 'booked' | 'approved' | 'paid';
    investmentDate: string; // Assuming date is in format 'YYYY-MM-DD'
    createdAt?: string; // Assuming it can be null
    updatedAt?: string; // Assuming it can be null
    Project: Project;
    User: User;
    ProjectPartnerInvestors: ProjectPartnerInvestor[];
}

export interface ProjectInvestorAttributes extends Optional<ProjectInvestor, 'idProjectInvestors'> { }
