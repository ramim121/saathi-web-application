import { Optional } from 'sequelize';

export default interface ProjectProperty {
    idProjectProperties?: number;
    idProjects: number;
    cattleLiveWeightRate: number;
    cattleInitialWeightMin: number;
    cattleInitialWeightMax: number;
    cattleFinalWeightMin: number;
    cattleFinalWeightMax: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface ProjectPropertyAttributes extends Optional<ProjectProperty, 'idProjectProperties'> { }

