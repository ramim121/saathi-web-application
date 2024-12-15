import { Optional } from 'sequelize';

import UserBank from './UserBank';
import User from './User';
import ProjectInvestor from './ProjectInvestor';

export default interface ProjectInvestmentBooking {
    idProjectInvestmentBookings: number;
    idUsers: number;
    paymentMethod: 'beftn' | 'rtgs' | 'npsb' | 'cash' | 'cheque';
    paymentConfirmationStatus: 'pending' | 'uploaded' | 'confirmed' | 'denied';
    bookingId?: string;
    paymentAmount?: number;
    paymentDate?: string;
    transactionId?: string;
    createdAt: Date;
    updatedAt: Date;
    proofOfPayment?: string;
    idUserBanks?: number;
    Users?: User[];
    UserBank?: UserBank;
    collectionRequired: 'yes' | 'no';
    collectionStatus: 'pending' | 'collected' | 'failed';
    collectionDate?: string;
    collectionLocation?: string;
    ProjectInvestors?: ProjectInvestor[];
}

export interface ProjectInvestmentBookingAttributes extends Optional<ProjectInvestmentBooking, 'idProjectInvestmentBookings'> { }