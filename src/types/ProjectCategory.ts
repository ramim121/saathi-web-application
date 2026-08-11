import { Optional } from 'sequelize';
import Project from './Project';

export default interface ProjectCategory {
    idProjectCategories: number;
    categoryName: string;
    // Bangla counterpart (migration 002); null falls back to English.
    categoryNameBn?: string | null;
    categoryImage: string | null;
    createdAt: Date;
    updatedAt: Date;
    Projects?: Project[];
}

export interface ProjectCategoryAttributes extends Optional<ProjectCategory, 'idProjectCategories'> { }
