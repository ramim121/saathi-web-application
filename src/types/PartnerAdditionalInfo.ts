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
    // Bangla counterparts (migration 002); null falls back to English.
    livelihood_activity_bn?: string | null;
    primary_goal_bn?: string | null;
    createdAt: Date;
    updatedAt: Date;
    User?: User;
}

export interface PartnerAdditionalInfoAttributes extends Optional<PartnerAdditionalInfo, 'idPartnerAdditionalInfo'> { }