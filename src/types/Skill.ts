import { Optional } from 'sequelize';

export default interface Skill {
    idSkills: number;
    skillName: string;
    createdAt: Date;
    updatedAt: Date;
};

export interface SkillAttributes extends Optional<Skill, 'idSkills'> { }