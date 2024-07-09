import { Optional } from 'sequelize';

import UserBank  from './UserBank';
import User from './User';
import ProjectInvestor from './ProjectInvestor';

export default interface ProjectInvestmentBooking {
    idProjectInvestmentBookings: number;
    idUsers: number;
    paymentMethod: 'bank' | 'cash' | 'card' | 'mobile';
    bookingId?: string;
    paymentAmount?: number;
    transactionId?: string;
    createDate: string;
    updateDate: string;
    idUserBanks?: number;
    Users?: User[];
    UserBank?: UserBank;
    ProjectInvestors?: ProjectInvestor[];
}

export interface ProjectInvestmentBookingAttributes extends Optional<ProjectInvestmentBooking, 'idProjectInvestmentBookings'> { }