import { Sequelize } from 'sequelize';
import { DB_NAME } from './constants';


// Option 1: Passing a connection URI
const sequelize = new Sequelize({
    dialect: 'mysql',
    dialectModule: require('mysql2'),
    host: 'saathi-db.cla6si4uaanu.ap-southeast-1.rds.amazonaws.com',
    port: 3306,
    username: 'saathi_admin',
    password: 'w607kTcCngWiq8U',
    database: DB_NAME
});// Example for postgres

export default sequelize;
