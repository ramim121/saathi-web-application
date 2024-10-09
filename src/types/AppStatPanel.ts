import { Optional } from 'sequelize';

export default interface AppStatPanel {
    idAppStatPanel: number;
    statLabel: string;
    statValue: string;
    statType: 'text' | 'number' | 'image';
    createdAt: Date;
    updatedAt: Date;
}

export interface AppStatPanelAttributes extends Optional<AppStatPanel, 'idAppStatPanel'> { }