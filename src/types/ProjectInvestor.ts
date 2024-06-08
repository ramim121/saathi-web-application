import { Optional } from 'sequelize';
import Project from './Project';
import User from './User';

export default interface ProjectInvestor {
    idProjectInvestors: number;
    idProjects: number;
    idUsers: number;
    unitPurchased: number;
    amountInvested: number;
    investmentStatus: 'booked' | 'approved' | 'paid';
    idProjectPartners: number;
    investmentDate: string; // Assuming date is in format 'YYYY-MM-DD'
    createdAt?: string; // Assuming it can be null
    updatedAt?: string; // Assuming it can be null
    Project?: Project;
    User?: User;
}

export interface ProjectInvestorAttributes extends Optional<ProjectInvestor, 'idProjectInvestors'> { }
