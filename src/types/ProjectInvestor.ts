import { Optional } from 'sequelize';
import Project from './Project';
import User from './User';
import ProjectPartnerInvestor from './ProjectPartnerInvestor';
import ProjectInvestmentBooking from './ProjectInvestmentBooking';

export default interface ProjectInvestor {
    idProjectInvestors: number;
    idProjects: number;
    idUsers: number;
    unitPurchased: number;
    investmentStatus: 'booked' | 'approved' | 'profit_added' | 'paid' | 'ready_for_withdrawal' | 'withdrawn';
    investmentDate: string; // Assuming date is in format 'YYYY-MM-DD'
    createdAt?: string; // Assuming it can be null
    updatedAt?: string; // Assuming it can be null
    Project: Project;
    User: User;
    ProjectPartnerInvestors: ProjectPartnerInvestor[];
    ProjectInvestmentBooking: ProjectInvestmentBooking
}

export interface ProjectInvestorAttributes extends Optional<ProjectInvestor, 'idProjectInvestors'> { }
