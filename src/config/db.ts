import { Sequelize } from 'sequelize';
import { DB_NAME, DB_HOST, DB_PASSWORD, DB_USER } from './constants';


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
