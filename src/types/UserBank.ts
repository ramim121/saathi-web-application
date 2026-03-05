import { Optional } from 'sequelize';
import User from './User';
import Bank from './Bank';
import BankBranch from './BankBranch';

export default interface UserBank {
    idUserBanks: number;
    idUsers: number;
    idBanks: number;
    idBankBranches: string;
    accountHolderName: string;
    accountNumber: string;
    default: 'yes' | 'no';
    User?: User;
    Bank?: Bank;
    BankBranch?: BankBranch;
}

export interface UserBankAttributes extends Optional<UserBank, 'idUserBanks'> { }