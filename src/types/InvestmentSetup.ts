import { Optional } from 'sequelize';

export default interface InvestmentSetup {
    idInvestmentSetup: number;
    planName: string;
    investmentType: 'sustainable_return' | 'fast_return';
    returnType: 'variable' | 'fixed';
    minimumReturn: number;
    maximumReturn: number;
    duration: number;
    tenure: 'months' | 'years';
    createdAt: Date;
    updatedAt: Date;
}

export interface InvestmentSetupAttributes extends Optional<InvestmentSetup, 'idInvestmentSetup'> { }