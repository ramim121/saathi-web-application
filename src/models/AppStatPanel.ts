import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/db';
import { AppStatPanelAttributes } from '@/types/AppStatPanel';

interface AppStatPanelModel extends AppStatPanelAttributes, Model { }

const AppStatPanel = sequelize.define<AppStatPanelModel>('AppStatPanel', {
    idAppStatPanel: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    statLabel: {
        type: DataTypes.STRING,
        allowNull: false
    },
    statValue: {
        type: DataTypes.STRING,
        allowNull: false
    },
    // Bangla counterparts — migration 002_bangla_columns.sql. Only meaningful
    // for statType 'text' / 'number'; every live row is currently 'image'.
    statLabelBn: {
        type: DataTypes.STRING,
        allowNull: true
    },
    statValueBn: {
        type: DataTypes.STRING,
        allowNull: true
    },
    statType: {
        type: DataTypes.ENUM('text', 'number', 'image'),
        allowNull: false
    },
    priority: {
        type: DataTypes.INTEGER,
        allowNull: true,
    },
    createdAt: {
        type: DataTypes.DATE,
        allowNull: false
    },
    updatedAt: {
        type: DataTypes.DATE,
        allowNull: false
    }
}, {
    tableName: 'app_stat_panel',
    underscored: true,
    timestamps: true,
});

export default AppStatPanel;