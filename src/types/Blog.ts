import { Optional } from 'sequelize';

export default interface Blog {
    idBlogs: number;
    heading: string;
    description: string;
    writtenBy: string;
    createdAt: Date;
    updatedAt: Date;
};

export interface BlogAttributes extends Optional<Blog, 'idBlogs'> { }