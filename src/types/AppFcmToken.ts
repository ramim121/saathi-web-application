import { Optional } from 'sequelize';

export default interface AppFcmToken {
    idAppFcmTokens: number;
    fcmToken: string;
    idUsers: number;
    publicationStatus: 'activated' | 'deactivated';
    createdAt: Date;
    updatedAt: Date;
}

export interface AppFcmTokenAttributes extends Optional<AppFcmToken, 'idAppFcmTokens'> { }