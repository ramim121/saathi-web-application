import { Optional } from 'sequelize';
import User from './User';
import Bank from './Bank';

export default interface UserBank {
    idUserBanks: number;
    idUsers: number;
    idBanks: number;
    branchName: string;
    accountHolderName: string;
    accountNumber: string;
    User?: User;
    Bank?: Bank;
}

export interface UserBankAttributes extends Optional<UserBank, 'idUserBanks'> { }