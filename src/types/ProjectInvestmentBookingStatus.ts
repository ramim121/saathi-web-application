import { Optional } from 'sequelize';
export default interface ProjectInvestmentBookingStatus {
    idProjectInvestmentBookingStatus: number;
    status: string;
    idProjectInvestmentBookings: number;
    idUsers: number;
    remarks: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface ProjectInvestmentBookingStatusAttributes extends Optional<ProjectInvestmentBookingStatus, 'idProjectInvestmentBookingStatus'> { }