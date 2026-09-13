import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/db';
import { ContactMessageAttributes } from '@/types/ContactMessage';

interface ContactMessageModel extends ContactMessageAttributes, Model { }

const ContactMessage = sequelize.define<ContactMessageModel>('ContactMessage', {
    idContactMessages: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    name: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    email: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    message: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    subject: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    phone: {
        type: DataTypes.STRING(15),
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
    tableName: 'contact_messages',
    underscored: true,
    timestamps: true,
});

export default ContactMessage;