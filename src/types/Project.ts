import { Optional } from 'sequelize';
import ProjectCategory from './ProjectCategory';
import ProjectPartner from './ProjectPartner';
import ProjectInvestor from './ProjectInvestor';
import User from './User';
import File from './File';
import ProjectProperty from './ProjectProperty';

export default interface Project {
    idProjects: number;
    projectName: string;
    summary?: string;
    returnRangeMin: number;
    returnRangeMax: number;
    investmentType: 'sustainable_return' | 'fast_return';
    returnType: 'variable' | 'fixed';
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
    // Bangla counterparts (migration 002). Null means "not translated yet" —
    // callers fall back to the English column.
    projectNameBn?: string | null;
    summaryBn?: string | null;
    descriptionBn?: string | null;
    locationBn?: string | null;
    otherLocationsBn?: string | null;
    createdAt?: string;
    updatedAt?: string;
    ProjectCategory?: ProjectCategory;
    CreatedBy?: User;
    showInUpcoming: 'yes' | 'no';
    projectStatus: 'created' | 'collection_started' | 'collection_done' | 'project_started' | 'project_finished' | 'fund_disbursed' | 'closed' | 'completed';
    ProjectPartners?: ProjectPartner[];
    ProjectInvestors?: ProjectInvestor[];
    totalAvailableUnits: number;
    investorUnitCapacity: number;
    MainImage?: File;
    FeaturedImages?: File[];
    ProjectProperty?: ProjectProperty;
    projectType: 'regular' | 'special';
};


export interface ProjectAttributes extends Optional<Project, 'idProjects'> { }
