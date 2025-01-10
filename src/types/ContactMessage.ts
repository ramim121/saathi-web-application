import { Optional } from 'sequelize';

export default interface ContactMessage {
    idContactMessages: number;
    name: string;
    email: string;
    message: string;
    subject: string;
    phone: string;
    createdAt: Date;
    updatedAt: Date;
};

export interface ContactMessageAttributes extends Optional<ContactMessage, 'idContactMessages'> { }