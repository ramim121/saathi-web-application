import { Optional } from 'sequelize';
import UserBank from './UserBank';
import User from './User';
import ProjectInvestor from './ProjectInvestor';

export default interface ProjectInvestmentBooking {
    idProjectInvestmentBookings: number;
    idUsers: number;
    paymentMethod: 'beftn' | 'rtgs' | 'npsb' | 'cash' | 'cheque';
    paymentConfirmationStatus: 'pending' | 'uploaded' | 'proof_submitted' | 'confirmed' | 'denied';
    /** End of the payment window, UTC (migration 017). */
    paymentDueAt?: Date | string | null;
    paymentRemindersSent?: number;
    bookingId?: string;
    paymentAmount?: number;
    paymentDate?: string;
    transactionId?: string;
    createdAt: Date;
    updatedAt: Date;
    proofOfPayment?: string;
    idUserBanks?: number;
    User?: User;
    UserBank?: UserBank;
    collectionRequired: 'yes' | 'no';
    collectionStatus: 'pending' | 'collected' | 'failed' | null;
    collectionDate?: string | null;
    collectionLocation?: string | null;
    cancelled: 'yes' | 'no';
    cancelReason?: 'investor' | 'admin' | 'expired' | 'reinvestment_undone' | null;
    cancelledAt?: Date | string | null;
    cancelledBy?: number | null;
    ProjectInvestors?: ProjectInvestor[];
    bookingType: 'fresh' | 'reinvestment';
    reinvestedAmount: number;
    idSourceProjectInvestors?: number | null;
}

export interface ProjectInvestmentBookingAttributes extends Optional<ProjectInvestmentBooking, 'idProjectInvestmentBookings'> { }