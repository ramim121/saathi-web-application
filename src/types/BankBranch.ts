import { Optional } from 'sequelize';

export default interface BankBranch {
    idBankBranches: number;
    idBanks: number;
    branchName: string;
    branchCode: string;
    bankId: string;
    routingNumber: string;
    address: string;
    swiftCode: string;
    telephone: string;
    fax: string;
    email: string;
    createdAt: string;
    updatedAt: string;
}

export interface BankBranchAttributes extends Optional<BankBranch, 'idBankBranches'> { }