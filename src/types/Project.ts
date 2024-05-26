import { Optional } from 'sequelize';


import ProjectCategory from './ProjectCategory';
import User from './User';
export default interface Project {
    idProjects: number;
    projectName: string;
    summary?: string;
    returnRangeMin: number;
    returnRangeMax: number;
    returnType: 'fixed' | 'range';
    duration: number;
    tenure: string;
    location: string;
    unitInvestmentValue: number;
    totalReturnMin: number;
    totalReturnMax: number;
    collectionStarts: string;
    collectionEnds: string;
    insurance: number;
    idProjectCategories: number;
    createdBy: number;
    projectBanner: string;
    otherLocations?: string;
    description?: string;
    createdAt?: string;
    updatedAt?: string;
    ProjectCategory?: ProjectCategory;
    CreatedBy?: User;
    projectStatus: 'created' | 'collection_started' | 'collection_done' | 'project_started' | 'project_finished' | 'fund_disbursed' | 'closed'
};


export interface ProjectAttributes extends Optional<Project, 'idProjects'> { }
