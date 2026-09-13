import { Optional } from 'sequelize';

export default interface DigigramBank {
    idDigigramBanks: number;
    bankName: string;
    branchName: string;
    accountName: string;
    accountNumber: string;
    routingNumber: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface DigigramBankAttributes extends Optional<DigigramBank, 'idDigigramBanks'> { }