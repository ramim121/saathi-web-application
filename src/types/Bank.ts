import { Optional } from 'sequelize';

export default interface Bank {
    idBanks: number;
    bankNameShort: string;
    bankNameFull: string;
    bankCode: string;
}

export interface BankAttributes extends Optional<Bank, 'idBanks'> { }