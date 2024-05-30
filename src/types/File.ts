import { Optional } from 'sequelize';

export default interface File {
    idFiles: number;
    originalFileName: string;
    fileName: string;
    refType: string;
    refId: number;
    createdAt: Date;
    updatedAt: Date;
};

export interface FileAttributes extends Optional<File, 'idFiles'> { }