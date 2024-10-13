import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/db';
import { SkillAttributes } from '@/types/Skill';

interface SkillModel extends SkillAttributes, Model { }

const Skill = sequelize.define<SkillModel>('Skill', {
    idSkills: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    skillName: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    createdAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    updatedAt: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: 'skills',
    underscored: true,
    timestamps: false,
});

export default Skill;