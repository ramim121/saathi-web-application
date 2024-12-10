import { Optional } from 'sequelize';

export default interface Blog {
    idBlogs: number;
    heading: string;
    description: string;
    featuredImage: string;
    featuredImageThumb: string;
    writtenBy: string;
    writtenDate: Date;
    createdAt: Date;
    updatedAt: Date;
};

export interface BlogAttributes extends Optional<Blog, 'idBlogs'> { }