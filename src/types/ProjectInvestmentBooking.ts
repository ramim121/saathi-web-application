export default interface ProjectInvestmentBookings {
    idProjectInvestmentBookings: number;
    idUsers: number;
    paymentMethod: 'bank' | 'cash' | 'card' | 'mobile';
    bookingId?: string;
    paymentAmount?: number;
    transactionId?: string;
    createDate: string;
    updateDate: string;
    idUserBanks?: number;
}
