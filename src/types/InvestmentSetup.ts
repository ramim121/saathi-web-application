import { Optional } from 'sequelize';

export default interface InvestmentSetup {
    idInvestmentSetup: number;
    planName: string;
    investmentType: 'high_return' | 'low_return' | 'short_duration' | 'long_duration' | 'shariah';
    returnType: 'variable' | 'fixed';
    minimumReturn: number;
    maximumReturn: number;
    duration: number;
    tenure: 'months' | 'years';
    createdAt: Date;
    updatedAt: Date;
}

export interface InvestmentSetupAttributes extends Optional<InvestmentSetup, 'idInvestmentSetup'> { }