import { Optional } from 'sequelize';
import Project from './Project';

export default interface ProjectCategory {
    idProjectCategories: number;
    categoryName: string;
    categoryImage: string | null;
    Projects?: Project[];
}

export interface ProjectCategoryAttributes extends Optional<ProjectCategory, 'idProjectCategories'> { }
