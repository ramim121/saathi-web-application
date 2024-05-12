import { Sequelize } from 'sequelize';

// Option 1: Passing a connection URI
const sequelize = new Sequelize({
    dialect:'mysql',
    dialectModule: require('mysql2'),
    host: '192.168.91.92',
    port: 3306,
    username: 'saathi_admin',
    password: 'w607kTcCngWiq8U',
    database: 'saathi_db',
    dialectOptions: {
        ssl: {
            rejectUnauthorized: true
        }
    }
});// Example for postgres

export default sequelize;