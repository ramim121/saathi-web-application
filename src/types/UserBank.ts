import { Optional } from 'sequelize';

export default interface UserBank {
    idUserBanks: number;
    idUsers: number;
    idBanks: number;
    accountHolderName: string;
    accountNumber: string;

}

export interface UserBankAttributes extends Optional<UserBank, 'idUserBanks'> { }