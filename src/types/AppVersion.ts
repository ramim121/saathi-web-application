import { Optional } from 'sequelize';

export default interface AppVersion {
    idAppVersions: number;
    versionName: string;
    platform: 'android' | 'ios';
    remarks: string;
    createdAt: string;
    updatedAt: string;
}

export interface AppVersionAttributes extends Optional<AppVersion, 'idAppVersions'> { }