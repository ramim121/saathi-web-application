import { Optional } from 'sequelize';
import User from './User';

export default interface PartnerAdditionalInfo {
    idPartnerAdditionalInfo: number;
    idUsers: number;
    gender: 'Male' | 'Female' | 'Other';
    household_size: string;
    dependents_size: string;
    livelihood_activity: string;
    primary_goal: string;
    createdAt: Date;
    updatedAt: Date;
    User?: User;
}

export interface PartnerAdditionalInfoAttributes extends Optional<PartnerAdditionalInfo, 'idPartnerAdditionalInfo'> { }