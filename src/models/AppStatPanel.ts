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
    statType: {
        type: DataTypes.ENUM('text', 'number', 'image'),
        allowNull: false
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