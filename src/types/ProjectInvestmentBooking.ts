import { Optional } from 'sequelize';

import UserBank from './UserBank';
import User from './User';
import ProjectInvestor from './ProjectInvestor';

export default interface ProjectInvestmentBooking {
    idProjectInvestmentBookings: number;
    idUsers: number;
    paymentMethod: 'bank' | 'cash' | 'card' | 'mobile';
    paymentConfirmationStatus: 'pending' | 'confirmed' | 'denied';
    bookingId?: string;
    paymentAmount?: number;
    paymentDate?: string;
    transactionId?: string;
    createdAt: Date;
    updatedAt: Date;
    idUserBanks?: number;
    Users?: User[];
    UserBank?: UserBank;
    ProjectInvestors?: ProjectInvestor[];
}

export interface ProjectInvestmentBookingAttributes extends Optional<ProjectInvestmentBooking, 'idProjectInvestmentBookings'> { }