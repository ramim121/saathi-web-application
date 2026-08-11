import { Optional } from 'sequelize';

export default interface Blog {
    idBlogs: number;
    heading: string;
    description: string;
    // Bangla counterparts (migration 002); null falls back to English.
    headingBn?: string | null;
    descriptionBn?: string | null;
    featuredImage: string;
    featuredImageThumb: string;
    writtenBy: string;
    writtenDate: Date;
    createdAt: Date;
    updatedAt: Date;
};

export interface BlogAttributes extends Optional<Blog, 'idBlogs'> { }