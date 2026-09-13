import { Optional } from 'sequelize';

export default interface AppStatPanel {
    idAppStatPanel: number;
    statLabel: string;
    statValue: string;
    // Bangla counterparts (migration 002); null falls back to English.
    statLabelBn?: string | null;
    statValueBn?: string | null;
    statType: 'text' | 'number' | 'image';
    priority: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface AppStatPanelAttributes extends Optional<AppStatPanel, 'idAppStatPanel'> { }