import { Sequelize } from 'sequelize';
import { DB_NAME, DB_HOST, DB_PASSWORD, DB_USER } from './constants';
import knex from 'knex';
import knexStringcase from 'knex-stringcase';


// Option 1: Passing a connection URI
const sequelize = new Sequelize({
    dialect: 'mysql',
    dialectModule: require('mysql2'),
    host: DB_HOST,
    port: 3306,
    username: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    logging: true
});// Example for postgres

export default sequelize;


export const db = knex(knexStringcase({
    client: 'mysql2',
    connection: {
        host: DB_HOST,
        user: DB_USER,
        password: DB_PASSWORD,
        database: DB_NAME
    }
}));
