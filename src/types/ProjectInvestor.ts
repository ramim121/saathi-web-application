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
    investmentStatus: 'booked' | 'confirmed' | 'request_withdrawal' | 'ready_for_withdrawal' | 'withdrawn' | 'reinvested_full' | 'reinvested_capital' | 'reinvested_profit' | 'cancelled';
    investmentDate: string;
    createdAt?: string;
    updatedAt?: string;
    actualProfitPercentage: number;
    actualProfitAmount: number;
    Project: Project;
    User: User;
    ProjectPartnerInvestors: ProjectPartnerInvestor[];
    ProjectInvestmentBooking: ProjectInvestmentBooking
}

export interface ProjectInvestorAttributes extends Optional<ProjectInvestor, 'idProjectInvestors'> { }
