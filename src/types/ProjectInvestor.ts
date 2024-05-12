interface ProjectInvestor {
    idProjectInvestors: number;
    idProjects: number;
    idUsers: number;
    unitPurchased: number;
    amountInvested: number;
    investmentStatus: 'pending' | 'approved' | 'paid';
    investmentDate: string; // Assuming date is in format 'YYYY-MM-DD'
    createdAt?: string; // Assuming it can be null
    updatedAt?: string; // Assuming it can be null
}