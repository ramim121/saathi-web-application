import { Optional } from 'sequelize';

export default interface InvestmentSetup {
    idInvestmentSetup: number;
    planName: string;
    type: 'high' | 'low' | 'short_duration' | 'long_duration';
    minimumReturn: number;
    maximumReturn: number;
    duration: number;
    tenure: 'months' | 'years';
    createdAt: Date;
    updatedAt: Date;
}

export interface InvestmentSetupAttributes extends Optional<InvestmentSetup, 'idInvestmentSetup'> { }