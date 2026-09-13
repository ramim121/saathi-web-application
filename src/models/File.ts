import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/db';
import { FileAttributes } from '@/types/File';

interface FileModel extends FileAttributes, Model { }

const File = sequelize.define<FileModel>('File', {
    idFiles: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    originalFileName: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    fileName: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    thumbnail: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    refType: {
        type: DataTypes.STRING(45),
        allowNull: true
    },
    refId: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    createdAt: {
        type: DataTypes.DATE,
        allowNull: false
    },
    updatedAt: {
        type: DataTypes.DATE,
        allowNull: false
    },
}, {
    tableName: 'files',
    underscored: true,
    timestamps: true,
});

export default File;