import { Optional } from 'sequelize';

export default interface Skill {
    idSkills: number;
    skillName: string;
};

export interface SkillAttributes extends Optional<Skill, 'idSkills'> { }